// File: app/api/analyze-reviews/route.ts
import { NextResponse } from 'next/server';

/**
 * Adds robust place resolution + retries:
 * - Accepts Google Maps short links, full links, plain names, or even an <iframe> embed block.
 * - Extracts src from iframe if present.
 * - Resolves to a stable `place_id:XXX` via Google Places API when not directly present.
 * - Retries Outscraper/OpenAI on 429/5xx with exponential backoff.
 */

type AnalyzeBody = {
  mapUrl: string;      // pasted input (URL/iframe/name)
  dateRange: string;   // "1" | "30" | "60" | "90" | "365"
};

const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY || process.env.NEXT_PUBLIC_OUTSCRAPER_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY; // used to resolve place_id

// ----------------------------- utils -----------------------------

function toUnixCutoff(days: string) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const cutoffMs = Date.now() - n * 24 * 60 * 60 * 1000;
  return Math.floor(cutoffMs / 1000);
}

function extractIframeSrc(input: string): string | null {
  const m = input.match(/<iframe[^>]*src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

function normalizeQueryFromUrlLike(s: string): string | null {
  try { s = decodeURIComponent(s); } catch {}
  // place_id=... or q=place_id:...
  const placeIdQ = /[?&]q=place_id:([A-Za-z0-9_-]+)/.exec(s);
  if (placeIdQ?.[1]) return `place_id:${placeIdQ[1]}`;
  const placeIdParam = /[?&]place_id=([A-Za-z0-9_-]+)/.exec(s);
  if (placeIdParam?.[1]) return `place_id:${placeIdParam[1]}`;
  // cid=...
  const cid = /[?&]cid=([0-9]+)/.exec(s);
  if (cid?.[1]) return `cid:${cid[1]}`;
  // sometimes "/place/NAME/data=...!3m1!4b1!4m6!3m5!...!8m2!3dLAT!4dLNG!16s%2Fg..." includes 16s=encoded place id
  const sixteenS = /!16s([^!]+)/.exec(s);
  if (sixteenS?.[1]) {
    try {
      const decoded = decodeURIComponent(sixteenS[1]).replace(/^%2F/,'/');
      if (decoded.startsWith('/g/')) return `place_id:${decoded.slice(1)}`; // /g/XXXX → place_id:g:XXXX
    } catch {}
  }
  return null; // not directly found
}

async function resolvePlaceIdViaGooglePlaces(text: string): Promise<string | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  // Use Find Place From Text API to get place_id
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', text);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'place_id');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const j = await res.json();
  const pid = j?.candidates?.[0]?.place_id as string | undefined;
  return pid ? `place_id:${pid}` : null;
}

async function deriveStableQuery(input: string): Promise<string> {
  let raw = input.trim();
  // If they pasted an iframe embed, extract the src
  const src = extractIframeSrc(raw);
  if (src) raw = src;

  // If looks like a URL, try direct parsing first
  if (/^https?:\/\//i.test(raw)) {
    const normalized = normalizeQueryFromUrlLike(raw);
    if (normalized) return normalized;
    // Fallback: use entire URL as text to resolve place_id via Places API
    const viaPlaces = await resolvePlaceIdViaGooglePlaces(raw);
    if (viaPlaces) return viaPlaces;
    return raw; // Outscraper can sometimes handle raw URLs
  }

  // Treat as plain business name → resolve via Places API
  const viaPlaces = await resolvePlaceIdViaGooglePlaces(raw);
  if (viaPlaces) return viaPlaces;
  return raw; // fallback
}

async function fetchWithRetry(url: string, init: RequestInit, tries = 4, baseDelayMs = 400) {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok && (res.status === 429 || res.status >= 500)) {
        lastErr = new Error(`HTTP ${res.status}`);
      } else {
        return res;
      }
    } catch (e) {
      lastErr = e;
    }
    const delay = baseDelayMs * Math.pow(2, i) + Math.floor(Math.random() * 150);
    await new Promise((r) => setTimeout(r, delay));
  }
  throw lastErr;
}

// Normalize Outscraper response -> array of review texts
function extractReviewTexts(json: any): string[] {
  const texts: string[] = [];
  const push = (s: any) => { if (typeof s === 'string' && s.trim()) texts.push(s.trim()); };

  try {
    const blocks = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    for (const b of blocks) {
      const arr = b?.reviews_data || b?.reviews || [];
      if (Array.isArray(arr)) {
        for (const r of arr) push(r?.review_text ?? r?.text ?? r?.content ?? r?.review);
      }
      push(b?.review_text ?? b?.text ?? b?.content ?? b?.review);
    }
    if (Array.isArray(json?.reviews)) {
      for (const r of json.reviews) push(r?.review_text ?? r?.text ?? r?.content ?? r?.review);
    }
  } catch {}

  return Array.from(new Set(texts)).slice(0, 250);
}

// ------------------------- Outscraper calls ------------------------

async function callOutscraperV3(query: string, reviewsLimit = 120, cutoff?: number) {
  const u = new URL('https://api.app.outscraper.com/maps/reviews-v3');
  u.searchParams.set('query', query);
  u.searchParams.set('reviewsLimit', String(reviewsLimit));
  u.searchParams.set('async', 'false');
  if (cutoff) u.searchParams.set('cutoff', String(cutoff));

  return fetchWithRetry(u.toString(), {
    headers: { 'X-API-KEY': OUTSCRAPER_API_KEY!, Accept: 'application/json' },
  });
}

async function callOutscraperAlt(query: string, reviewsLimit = 120, cutoff?: number) {
  const payload: Record<string, any> = {
    query: [query],
    reviewsLimit,
    async: false,
    sort: 'newest',
  };
  if (cutoff) payload.cutoff = cutoff;

  return fetchWithRetry('https://api.app.outscraper.com/api/google_maps/reviews', {
    method: 'POST',
    headers: {
      'X-API-KEY': OUTSCRAPER_API_KEY!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

// ---------------------------- AI step -----------------------------

async function analyzeWithAI(reviews: string[]) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

  const prompt = `Return STRICT JSON only with keys: positives, negatives, actions, summary.
- positives: top 5 short positive recurring themes
- negatives: top 5 short negative recurring themes
- actions: 6-10 practical steps
- summary: 2-3 sentences

REVIEWS:
${reviews.map((r) => `- ${r}`).join('
')}`;

  const r = await fetchWithRetry(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return only valid JSON. No prose.' },
          { role: 'user', content: prompt },
        ],
      }),
    },
    4,
    500
  );

  if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);

  const raw = await r.json();
  let json: any = {};
  try {
    json = JSON.parse(raw?.choices?.[0]?.message?.content ?? '{}');
  } catch {
    json = { positives: [], negatives: [], actions: [], summary: '' };
  }

  return {
    positives: Array.isArray(json.positives) ? json.positives.slice(0, 5) : [],
    negatives: Array.isArray(json.negatives) ? json.negatives.slice(0, 5) : [],
    actions: Array.isArray(json.actions) ? json.actions.slice(0, 12) : [],
    summary: typeof json.summary === 'string' ? json.summary : '',
  };
}

// ---------------------------- handler -----------------------------

export async function POST(req: Request) {
  try {
    if (!OUTSCRAPER_API_KEY) {
      return NextResponse.json({ error: 'Missing OUTSCRAPER_API_KEY on server.' }, { status: 500 });
    }

    const { mapUrl, dateRange } = (await req.json()) as AnalyzeBody;
    if (!mapUrl) return NextResponse.json({ error: 'mapUrl is required' }, { status: 400 });

    const cutoff = toUnixCutoff(dateRange);
    const query = await deriveStableQuery(mapUrl);

    // Primary attempt
    let res = await callOutscraperV3(query, 120, cutoff);

    // Fallback if 404/405
    if (res.status === 404 || res.status === 405) {
      res = await callOutscraperAlt(query, 120, cutoff);
    }

    if (!res.ok) {
      return NextResponse.json({ error: `Outscraper error (${res.status}): ${await res.text()}` }, { status: 502 });
    }

    const json = await res.json();
    const reviews = extractReviewTexts(json);

    if (!reviews.length) {
      return NextResponse.json({ error: 'No reviews found for that link & date range' }, { status: 404 });
    }

    const analysis = await analyzeWithAI(reviews);
    return NextResponse.json({ reviews, analysis, input: { mapUrl, dateRange, query } });
  } catch (err: any) {
    console.error('analyze-reviews error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
