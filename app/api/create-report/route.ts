import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type CreateReportBody = {
  placeInput: string;      // Google Maps URL, name, or query text
  days?: number;           // 30 | 60 | 90 | 365 (default 30)
};

type OutscraperJob = {
  results_location?: string;
  status?: string;
  data?: any;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitizeReviews(raw: any): string[] {
  if (!raw) return [];
  const data = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
  const first = data?.[0];
  const reviews = first?.reviews || [];
  return reviews
    .map((r: any) => r?.review_text || r?.text || '')
    .filter((s: string) => !!s && s.trim().length > 0);
}

async function resolvePlaceId(placeInput: string): Promise<{ placeId?: string; name?: string; error?: string; }> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return { error: 'GOOGLE_MAPS_API_KEY is missing' };

    const url = 'https://places.googleapis.com/v1/places:searchText';
    const body = { textQuery: placeInput };
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return { error: `Places API error ${resp.status}: ${txt}` };
    }
    const json = await resp.json();
    const place = json?.places?.[0];
    if (!place?.id) return { error: 'No place found for input' };
    const name = place?.displayName?.text || '';
    return { placeId: place.id.replace('places/', ''), name };
  } catch (e: any) {
    return { error: e?.message || 'resolvePlaceId failed' };
  }
}

async function fetchReviewsOutscraper(placeId: string, periodDays: number): Promise<any> {
  const key = process.env.OUTSCRAPER_API_KEY;
  if (!key) throw new Error('OUTSCRAPER_API_KEY is missing');

  const submitUrl =
    `https://api.app.outscraper.com/api/google_maps/reviews` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&reviews_limit=200&sort=newest&ignore_empty=1&language=en` +
    `&reviews_period=${periodDays}d`;

  const submit = await fetch(submitUrl, {
    headers: { 'X-API-KEY': key },
    cache: 'no-store',
  });

  if (!submit.ok) {
    const txt = await submit.text();
    throw new Error(`Outscraper submit failed (${submit.status}): ${txt}`);
  }

  const job: OutscraperJob = await submit.json();
  const resultsLoc = job?.results_location;
  if (!resultsLoc) {
    if (job?.data) return job;
    throw new Error('Outscraper missing results_location');
  }

  const start = Date.now();
  while (Date.now() - start < 60000) {
    const poll = await fetch(resultsLoc, {
      headers: { 'X-API-KEY': key },
      cache: 'no-store',
    });

    const text = await poll.text();
    if (poll.ok) {
      try {
        const json = JSON.parse(text);
        if (json?.status?.toLowerCase?.() === 'success' || Array.isArray(json)) {
          return json;
        }
      } catch {}
    }
    await sleep(1500);
  }

  throw new Error('Outscraper poll timed out');
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

    const resolved = await resolvePlaceId(placeInput);
    if (resolved.error || !resolved.placeId) {
      return NextResponse.json({ error: resolved.error || 'Failed to resolve place_id' }, { status: 400 });
    }

    const raw = await fetchReviewsOutscraper(resolved.placeId, periodDays);
    const reviews = sanitizeReviews(raw);

    return NextResponse.json({
      ok: true,
      placeId: resolved.placeId,
      placeName: resolved.name || '',
      days: periodDays,
      reviewCount: reviews.length,
      reviews,
      source: 'outscraper',
      note: 'Resolved via Google Places; fetched via Outscraper job/poll',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
