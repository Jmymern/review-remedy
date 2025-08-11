import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type CreateReportBody = { placeInput: string; days?: number };
type OutscraperJob = { results_location?: string; status?: string; data?: any };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitizeReviews(raw: any): string[] {
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
}

/** Robust resolver:
 * - Strips pasted <iframe ...> HTML
 * - Tries Places v1 searchText
 * - Falls back to legacy findplacefromtext
 */
async function resolvePlaceId(placeInput: string): Promise<{ placeId?: string; name?: string; error?: string }> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return { error: 'GOOGLE_MAPS_API_KEY is missing' };

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
      }
    } catch {}

    // legacy: findplacefromtext
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
  } catch (e: any) {
    return { error: e?.message || 'resolvePlaceId failed' };
  }
}

async function fetchReviewsOutscraper_placeId(placeId: string, periodDays: number): Promise<any> {
  const key = process.env.OUTSCRAPER_API_KEY;
  if (!key) throw new Error('OUTSCRAPER_API_KEY is missing');

  const submitUrl =
    `https://api.app.outscraper.com/api/google_maps/reviews` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&reviews_limit=200&sort=newest&ignore_empty=1&language=en` +
    `&reviews_period=${periodDays}d`;

  const submit = await fetch(submitUrl, { headers: { 'X-API-KEY': key }, cache: 'no-store' });
  if (!submit.ok) {
    const txt = await submit.text();
    throw new Error(`Outscraper submit(place_id) ${submit.status}: ${txt}`);
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
  throw new Error('Outscraper poll(place_id) timed out');
}

async function fetchReviewsOutscraper_query(query: string, periodDays: number): Promise<any> {
  const key = process.env.OUTSCRAPER_API_KEY;
  if (!key) throw new Error('OUTSCRAPER_API_KEY is missing');

  const submitUrl =
    `https://api.app.outscraper.com/api/google_maps/reviews` +
    `?query=${encodeURIComponent(query)}` +
    `&reviews_limit=200&sort=newest&ignore_empty=1&language=en` +
    `&reviews_period=${periodDays}d`;

  const submit = await fetch(submitUrl, { headers: { 'X-API-KEY': key }, cache: 'no-store' });
  if (!submit.ok) {
    const txt = await submit.text();
    throw new Error(`Outscraper submit(query) ${submit.status}: ${txt}`);
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
  throw new Error('Outscraper poll(query) timed out');
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateReportBody;
    const placeInput = (body?.placeInput || '').trim();
    const periodDays = Number(body?.days || 30);

    if (!placeInput) {
      return NextResponse.json({ error: 'placeInput is required' }, { status: 400 });
    }
    if (![30, 60, 90, 365].includes(periodDays)) {
      return NextResponse.json({ error: 'days must be one of 30, 60, 90, 365' }, { status: 400 });
    }

    // Resolve to place_id
    const resolved = await resolvePlaceId(placeInput);

    // Try place_id first; on any failure, automatically retry with query
    let rawOut: any;
    if (resolved.placeId) {
      try {
        rawOut = await fetchReviewsOutscraper_placeId(resolved.placeId, periodDays);
      } catch (err) {
        // fallback to query mode
        rawOut = await fetchReviewsOutscraper_query(placeInput, periodDays);
      }
    } else {
      rawOut = await fetchReviewsOutscraper_query(placeInput, periodDays);
    }

    const reviews = sanitizeReviews(rawOut);

    return NextResponse.json({
      ok: true,
      placeId: resolved.placeId || null,
      placeName: resolved.name || '',
      days: periodDays,
      reviewCount: reviews.length,
      reviews,
      source: 'outscraper',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
