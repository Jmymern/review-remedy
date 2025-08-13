// app/api/create-report/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ------------ Types
type CreateReportBody = { placeInput: string; days?: number };
type OutscraperJob = { results_location?: string; status?: string; data?: any };

// ------------ Utilities
const asJson = (obj: any, status = 200) =>
  NextResponse.json(obj, { status });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sanitizeReviews = (raw: any): string[] => {
  try {
    const data = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
    const first = data?.[0];
    const reviews = first?.reviews || [];
    return reviews
      .map((r: any) => r?.review_text || r?.text || '')
      .filter((s: string) => !!s && s.trim().length > 0);
  } catch {
    return [];
  }
};

const normalizeInput = (v: string) =>
  v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// ------------ Google Places resolver (v1 + legacy fallback)
async function resolvePlaceId(placeInput: string): Promise<{ placeId?: string; name?: string; error?: string }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { error: 'Missing GOOGLE_MAPS_API_KEY' };

  const raw = normalizeInput(placeInput);

  // Try Places v1 searchText
  try {
    const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName',
      },
      body: JSON.stringify({ textQuery: raw }),
      cache: 'no-store',
    });
    if (resp.ok) {
      const json = await resp.json();
      const p = json?.places?.[0];
      if (p?.id) {
        return { placeId: String(p.id).replace('places/', ''), name: p?.displayName?.text || '' };
      }
    }
  } catch {}

  // Fallback: legacy findplacefromtext
  try {
    const url =
      'https://maps.googleapis.com/maps/api/place/findplacefromtext/json' +
      `?input=${encodeURIComponent(raw)}` +
      `&inputtype=textquery&fields=place_id,name&key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (resp.ok) {
      const json = await resp.json();
      const c = json?.candidates?.[0];
      if (c?.place_id) return { placeId: c.place_id, name: c?.name || '' };
    }
  } catch {}

  return { error: 'No place found for input' };
}

// ------------ Outscraper calls
async function outscraperSubmitAndPoll(submitUrl: string, key: string, label: string) {
  const submit = await fetch(submitUrl, { headers: { 'X-API-KEY': key }, cache: 'no-store' });
  if (!submit.ok) {
    const txt = await submit.text();
    throw new Error(`Outscraper submit(${label}) ${submit.status}: ${txt}`);
  }

  const job: OutscraperJob = await submit.json();
  const resultsLoc = job?.results_location;
  if (!resultsLoc) return job?.data ? job : job;

  const start = Date.now();
  while (Date.now() - start < 60000) {
    const poll = await fetch(resultsLoc, { headers: { 'X-API-KEY': key }, cache: 'no-store' });
    const txt = await poll.text();
    if (poll.ok) {
      try {
        const json = JSON.parse(txt);
        if (json?.status?.toLowerCase?.() === 'success' || Array.isArray(json)) return json;
      } catch {}
    }
    await sleep(1500);
  }
  throw new Error(`Outscraper poll(${label}) timed out`);
}

async function fetchByPlaceId(placeId: string, days: number) {
  const key = process.env.OUTSCRAPER_API_KEY;
  if (!key) throw new Error('Missing OUTSCRAPER_API_KEY');

  const url =
    `https://api.app.outscraper.com/api/google_maps/reviews` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&reviews_limit=200&sort=newest&ignore_empty=1&language=en` +
    `&reviews_period=${days}d`;

  return outscraperSubmitAndPoll(url, key, 'place_id');
}

async function fetchByQuery(query: string, days: number) {
  const key = process.env.OUTSCRAPER_API_KEY;
  if (!key) throw new Error('Missing OUTSCRAPER_API_KEY');

  const url =
    `https://api.app.outscraper.com/api/google_maps/reviews` +
    `?query=${encodeURIComponent(query)}` +
    `&reviews_limit=200&sort=newest&ignore_empty=1&language=en` +
    `&reviews_period=${days}d`;

  return outscraperSubmitAndPoll(url, key, 'query');
}

// ------------ Optional AI analysis (runs only if key present)
async function analyzeWithOpenAI(reviews: string[]) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return null; // optional

  const sample = reviews.slice(0, 80); // keep token cost sane
  const prompt = [
    'You are an operations and CX analyst.',
    'Summarize key themes from these Google reviews:',
    JSON.stringify(sample),
    'Output JSON with keys: strengths[], issues[], opportunities[], tone.',
  ].join('\n\n');

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content ?? '';
    // Try parse JSON; if not JSON, return plain text
    try { return JSON.parse(text); } catch { return { summary: text }; }
  } catch {
    return null;
  }
}

// ------------ Handlers
export async function GET() {
  // Method not allowed for browser hits; keeps logs clean
  return asJson({ ok: false, error: 'Method Not Allowed' }, 405);
}

export async function POST(req: Request) {
  try {
    // 1) Parse & validate input
    const body = (await req.json()) as CreateReportBody;
    const placeInput = (body?.placeInput || '').trim();
    const days = Number(body?.days || 30);

    if (!placeInput) return asJson({ ok: false, error: 'placeInput is required' }, 400);
    if (![30, 60, 90, 365].includes(days)) return asJson({ ok: false, error: 'days must be one of 30, 60, 90, 365' }, 400);

    // 2) Resolve place (best-effort)
    const resolved = await resolvePlaceId(placeInput);

    // 3) Fetch reviews: try place_id first; if that fails, retry with query
    let raw: any;
    if (resolved.placeId) {
      try {
        raw = await fetchByPlaceId(resolved.placeId, days);
      } catch (e: any) {
        // Typical for smaller places -> fallback to query
        raw = await fetchByQuery(placeInput, days);
      }
    } else {
      // No place id found; go straight to query mode
      raw = await fetchByQuery(placeInput, days);
    }

    // 4) Clean reviews
    const reviews = sanitizeReviews(raw);

    // 5) Optional AI analysis
    const analysis = await analyzeWithOpenAI(reviews);

    // 6) Respond
    return asJson({
      ok: true,
      placeId: resolved.placeId || null,
      placeName: resolved.name || '',
      days,
      reviewCount: reviews.length,
      reviews,
      analysis,            // null if OPENAI_API_KEY not set
      source: 'outscraper'
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    // Return actionable error; do NOT 500 with no body
    return asJson({ ok: false, error: msg }, 500);
  }
}
