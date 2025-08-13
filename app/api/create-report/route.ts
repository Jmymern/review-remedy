// app/api/create-report/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type CreateReportBody = { placeInput: string; days?: number };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitizeReviews(raw: any): string[] {
  if (!raw) return [];
  // Outscraper (UI or async) returns either {data:[{reviews:[...]}]} or [{...}]
  const data = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
  const first = data?.[0];
  const reviews = first?.reviews || first?.reviews_data || [];
  return (reviews as any[])
    .map((r: any) => r?.review_text || r?.text || '')
    .filter((s: string) => !!s && s.trim().length > 0);
}

/* ----------------------- GOOGLE PLACES RESOLUTION ----------------------- */
async function resolvePlaceId(placeInput: string): Promise<{ placeId?: string; name?: string; error?: string }> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return { error: 'GOOGLE_MAPS_API_KEY is missing' };

    console.log('[resolvePlaceId] Resolving:', placeInput);

    const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName',
      },
      body: JSON.stringify({ textQuery: placeInput }),
      cache: 'no-store',
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('[resolvePlaceId] Google error:', resp.status, txt);
      return { error: `Places API error ${resp.status}: ${txt}` };
    }

    const json = await resp.json();
    const p = json?.places?.[0];
    if (!p?.id) return { error: 'No place found for input' };
    const name = p?.displayName?.text || '';
    return { placeId: String(p.id).replace('places/', ''), name };
  } catch (e: any) {
    console.error('[resolvePlaceId] Exception:', e);
    return { error: e?.message || 'resolvePlaceId failed' };
  }
}

/* ---------------------------- OUTSCRAPER ---------------------------- */
/** Build robust URL for Outscraper (new host). Send both camelCase and snake_case params. */
function buildOutscraperUrl(opts: { placeId?: string | null; query?: string; days: number }) {
  const base = 'https://api.outscraper.cloud/api/google_maps/reviews'; // << correct host
  const params = new URLSearchParams();

  if (opts.placeId) params.set('place_id', String(opts.placeId));
  else if (opts.query) params.set('query', String(opts.query));

  // Both param styles (server ignores unknowns)
  params.set('reviewsLimit', '200');
  params.set('reviews_limit', '200');

  params.set('sort', 'newest');
  params.set('ignoreEmpty', '1');
  params.set('ignore_empty', '1');
  params.set('language', 'en');

  // Period: support legacy “Xd” as well as time window via cutoff if they change
  params.set('reviews_period', `${opts.days}d`);

  // Force classic async job (we poll)
  params.set('async', 'true');
  params.set('ui', 'false');

  return `${base}?${params.toString()}`;
}

async function outscraperSubmitAndPoll(submitUrl: string): Promise<any> {
  const key = process.env.OUTSCRAPER_API_KEY;
  if (!key) throw new Error('OUTSCRAPER_API_KEY is missing');

  console.log('[Outscraper] Submit URL:', submitUrl);
  const submit = await fetch(submitUrl, {
    headers: { 'X-API-KEY': key },
    cache: 'no-store',
  });

  const rawTxt = await submit.text();
  if (!submit.ok) {
    console.error('[Outscraper] Submit error:', submit.status, rawTxt);
    // bubble up full message; caller will decide fallback
    throw new Error(`Outscraper submit failed (${submit.status}): ${rawTxt}`);
  }

  let job: any;
  try { job = JSON.parse(rawTxt); } catch { job = rawTxt; }
  console.log('[Outscraper] Job response:', typeof job === 'string' ? job : JSON.stringify(job, null, 2));

  // Some plans return data inline
  if (job?.data) return job;

  const resultsLoc = job?.results_location;
  if (!resultsLoc) throw new Error('Outscraper missing results_location');

  // poll up to 60s
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    const poll = await fetch(resultsLoc, { headers: { 'X-API-KEY': key }, cache: 'no-store' });
    const txt = await poll.text();
    try {
      if (poll.ok) {
        const json = JSON.parse(txt);
        console.log('[Outscraper] Poll:', JSON.stringify(json, null, 2));
        if (json?.status?.toLowerCase?.() === 'success' || Array.isArray(json)) return json;
      } else {
        console.warn('[Outscraper] Poll non-ok:', poll.status, txt);
      }
    } catch {
      // not JSON yet
      console.log('[Outscraper] Poll (not JSON yet):', txt.slice(0, 200));
    }
    await sleep(1500);
  }
  throw new Error('Outscraper poll timed out');
}

async function fetchReviewsOutscraper(placeId: string | null, query: string, days: number) {
  const url = buildOutscraperUrl({ placeId, query, days });
  return outscraperSubmitAndPoll(url);
}

/* ------------------------------ SERPAPI ------------------------------ */
/** Fallback if Outscraper path fails. */
async function fetchReviewsSerpApi(placeId: string | null, query: string, days: number): Promise<any> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error('SERPAPI_KEY is missing');

  // Prefer place_id if we have it; else use q=
  const base = 'https://serpapi.com/search.json';
  const params = new URLSearchParams();
  params.set('engine', 'google_maps_reviews');
  params.set('hl', 'en');
  if (placeId) params.set('place_id', placeId);
  else params.set('q', query);

  // SerpAPI returns pages of 10; we’ll fetch first 20 reviews (2 pages)
  params.set('num', '20');
  params.set('api_key', key);

  const url = `${base}?${params.toString()}`;
  console.log('[SerpAPI] URL:', url);

  const r = await fetch(url, { cache: 'no-store' });
  const txt = await r.text();
  if (!r.ok) {
    console.error('[SerpAPI] Error:', r.status, txt);
    throw new Error(`SerpAPI failed (${r.status}): ${txt}`);
  }
  let json: any;
  try { json = JSON.parse(txt); } catch { json = txt; }

  // Normalize to Outscraper-like shape
  const reviews = (json?.reviews || []) as any[];
  return { data: [{ reviews: reviews.map((rv: any) => ({ review_text: rv?.snippet || rv?.text || '' })) }] };
}

/* ------------------------------ OPENAI ------------------------------ */
async function analyzeReviewsWithAI(reviews: string[]): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[AI] OPENAI_API_KEY not set; skipping analysis.');
    return null;
  }

  console.log(`[AI] Analyzing ${reviews.length} reviews with OpenAI`);

  const prompt = `
You are an expert business review analyst. From the following reviews, produce:

1) Top 5 POSITIVE themes (short title – one line)
2) Top 5 NEGATIVE themes (short title – one line)
3) Improvement plan (bullets)
4) Keep & Leverage plan (bullets)

Return either JSON:
{"positives":[],"negatives":[],"improve":[],"keep":[]}
OR clearly labeled sections with bullet points.

REVIEWS:
${reviews.join('\n')}
`.trim();

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: 'You are a concise, practical review analyst.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('[AI] OpenAI error:', resp.status, txt);
    return null;
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || null;
}

/* ------------------------------ HANDLERS ------------------------------ */

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Method Not Allowed' }, { status: 405 });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateReportBody;
    const placeInput = (body?.placeInput || '').trim();
    const days = Number(body?.days || 30);

    console.log('[POST] Incoming:', { placeInput, days });

    if (!placeInput) return NextResponse.json({ error: 'placeInput is required' }, { status: 400 });
    if (![30, 60, 90, 365].includes(days)) {
      return NextResponse.json({ error: 'days must be one of 30, 60, 90, 365' }, { status: 400 });
    }

    const resolved = await resolvePlaceId(placeInput);
    const placeId = resolved.placeId || null;

    let raw: any;
    try {
      // PRIMARY: Outscraper (new host + robust params)
      raw = await fetchReviewsOutscraper(placeId, placeInput, days);
    } catch (outsErr) {
      console.warn('[POST] Outscraper failed. Switching to SerpAPI fallback…', outsErr);
      // FALLBACK: SerpAPI
      raw = await fetchReviewsSerpApi(placeId, placeInput, days);
    }

    const reviews = sanitizeReviews(raw);
    if (!reviews.length) return NextResponse.json({ error: 'No reviews found' }, { status: 404 });

    const aiAnalysis = await analyzeReviewsWithAI(reviews);

    return NextResponse.json({
      ok: true,
      placeId,
      placeName: resolved.name || '',
      days,
      reviewCount: reviews.length,
      reviews,
      aiAnalysis, // may be null if OPENAI key absent
      source: raw?.data ? 'outscraper' : 'serpapi',
    });
  } catch (e: any) {
    console.error('[POST] Fatal error:', e);
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
