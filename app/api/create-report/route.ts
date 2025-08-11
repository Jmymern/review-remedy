import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type CreateReportBody = { placeInput: string; days?: number };
type OutscraperJob = { results_location?: string; status?: string; data?: any };

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function sanitizeReviews(raw: any): string[] {
  try {
    const data = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
    const first = data?.[0];
    const reviews = first?.reviews || [];
    return reviews.map((r: any) => r?.review_text || r?.text || '').filter((s: string) => !!s && s.trim().length > 0);
  } catch { return []; }
}

// ---- DEBUG helper
function debugJson(obj: any, status = 200) {
  return NextResponse.json(obj, { status });
}

/** Robust resolver with fallback, strips embed HTML */
async function resolvePlaceId(placeInput: string) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { error: 'GOOGLE_MAPS_API_KEY is missing' as const };

  const raw = placeInput.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // v1: searchText
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
      if (p?.id) return { placeId: String(p.id).replace('places/', ''), name: p?.displayName?.text || '' };
    } else {
      const txt = await resp.text();
      console.error('places:v1 searchText not ok', resp.status, txt);
    }
  } catch (e) {
    console.error('places:v1 searchText threw', e);
  }

  // legacy: findplacefromtext
  try {
    const url = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json'
      + `?input=${encodeURIComponent(raw)}&inputtype=textquery&fields=place_id,name&key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (resp.ok) {
      const json = await resp.json();
      const c = json?.candidates?.[0];
      if (c?.place_id) return { placeId: c.place_id, name: c?.name || '' };
    } else {
      const txt = await resp.text();
      console.error('places:legacy findplace not ok', resp.status, txt);
    }
  } catch (e) {
    console.error('places:legacy findplace threw', e);
  }

  return { error: 'No place found for input' as const };
}

async function fetchReviewsOutscraper(placeId: string, periodDays: number) {
  const key = process.env.OUTSCRAPER_API_KEY;
  if (!key) throw new Error('OUTSCRAPER_API_KEY is missing');

  const submitUrl = `https://api.app.outscraper.com/api/google_maps/reviews?place_id=${encodeURIComponent(placeId)}&reviews_limit=200&sort=newest&ignore_empty=1&language=en&reviews_period=${periodDays}d`;

  const submit = await fetch(submitUrl, { headers: { 'X-API-KEY': key }, cache: 'no-store' });
  if (!submit.ok) throw new Error(`Outscraper submit failed (${submit.status}): ${await submit.text()}`);

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
      } catch { /* keep polling */ }
    }
    await sleep(1500);
  }
  throw new Error('Outscraper poll timed out');
}

async function fetchReviewsOutscraperByQuery(query: string, periodDays: number) {
  const key = process.env.OUTSCRAPER_API_KEY;
  if (!key) throw new Error('OUTSCRAPER_API_KEY is missing');

  const submitUrl = `https://api.app.outscraper.com/api/google_maps/reviews?query=${encodeURIComponent(query)}&reviews_limit=200&sort=newest&ignore_empty=1&language=en&reviews_period=${periodDays}d`;

  const submit = await fetch(submitUrl, { headers: { 'X-API-KEY': key }, cache: 'no-store' });
  if (!submit.ok) throw new Error(`Outscraper submit failed (${submit.status}): ${await submit.text()}`);

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
      } catch { /* keep polling */ }
    }
    await sleep(1500);
  }
  throw new Error('Outscraper poll timed out');
}

export async function POST(req: Request) {
  let stage = 'init';
  try {
    stage = 'parse-body';
    const body = (await req.json()) as CreateReportBody;
    const placeInput = (body?.placeInput || '').trim();
    const periodDays = Number(body?.days || 30);

    if (!placeInput) return debugJson({ ok: false, stage, error: 'placeInput is required' }, 400);
    if (![30, 60, 90, 365].includes(periodDays)) return debugJson({ ok: false, stage, error: 'bad days' }, 400);

    stage = 'resolve-place';
    const resolved = await resolvePlaceId(placeInput);

    stage = resolved.placeId ? 'outscraper-by-place' : 'outscraper-by-query';
    const rawOut = resolved.placeId
      ? await fetchReviewsOutscraper(resolved.placeId, periodDays)
      : await fetchReviewsOutscraperByQuery(placeInput, periodDays);

    stage = 'sanitize';
    const reviews = sanitizeReviews(rawOut);

    stage = 'done';
    return debugJson({
      ok: true,
      stage,
      placeId: resolved.placeId || null,
      placeName: resolved.name || '',
      days: periodDays,
      reviewCount: reviews.length,
      reviews,
      source: 'outscraper',
    });
  } catch (e: any) {
    console.error('analyze error', stage, e?.stack || e?.message || e);
    return debugJson({ ok: false, stage, error: e?.message || 'Unexpected error' }, 500);
  }
}
