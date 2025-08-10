import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'v3-cloud+serp-fallback',
    outscraper: !!process.env.OUTSCRAPER_API_KEY,
    serpapi: !!process.env.SERPAPI_KEY,
  });
}

type ResolveResp = {
  normalizedUrl?: string;
  placeId?: string;
  name?: string;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitizeReviews(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first?.reviews) {
      return first.reviews
        .map((r: any) => r?.review_text || r?.text || '')
        .filter(Boolean);
    }
  }
  if (raw?.reviews && Array.isArray(raw.reviews)) {
    return raw.reviews.map((r: any) => r?.snippet || r?.text || r?.review_text || '').filter(Boolean);
  }
  return [];
}

async function analyzeWithAI(OPENAI_API_KEY: string, reviews: string[]) {
  const prompt = `You are Review Remedy. Analyze these customer reviews and produce:
1) Top 5 Positives (short bullet points)
2) Top 5 Negatives (short bullet points)
3) Action Steps (5–8 short bullets businesses can act on)
4) One-sentence Summary

REVIEWS:\n${reviews.map((r) => `- ${r}`).join('\n')}`;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    }),
  });

  if (!r.ok) throw new Error(`AI error (${r.status}): ${await r.text()}`);
  const data = await r.json();
  const text: string = data?.choices?.[0]?.message?.content || '';

  const getSection = (label: string, next?: string) => {
    const s = text.indexOf(label);
    if (s < 0) return '';
    const start = s + label.length;
    if (!next) return text.slice(start).trim();
    const e = text.indexOf(next, start);
    return (e < 0 ? text.slice(start) : text.slice(start, e)).trim();
  };

  const positives = getSection('Top 5 Positives', 'Top 5 Negatives')
    .split('\n').map((l) => l.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean).slice(0, 5);

  const negatives = getSection('Top 5 Negatives', 'Action Steps')
    .split('\n').map((l) => l.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean).slice(0, 5);

  const actions = getSection('Action Steps', 'Summary')
    .split('\n').map((l) => l.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean).slice(0, 8);

  const summary = getSection('Summary').split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';

  return { positives, negatives, actions, summary };
}

async function serverResolvePlaceId(input: string): Promise<ResolveResp> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { error: 'Missing GOOGLE_MAPS_API_KEY' };
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(input)}&inputtype=textquery&fields=place_id,name&key=${key}`;
  const r = await fetch(url, { cache: 'no-store' });
  const data = await r.json();
  if (!data?.candidates?.length) return { error: 'Could not resolve place_id' };
  const { place_id: placeId, name } = data.candidates[0];
  return { normalizedUrl: input, placeId, name };
}

async function fetchOutscraperReviews(placeId: string, dateRange: string, key: string) {
  const submitUrl = `https://api.app.outscraper.com/maps/reviews-v3?query=${encodeURIComponent(`place_id:${placeId}`)}&reviewsLimit=80&reviewsPeriod=${encodeURIComponent(dateRange)}`;
  const submit = await fetch(submitUrl, { headers: { 'X-API-KEY': key }, cache: 'no-store' });
  if (!submit.ok) throw new Error(`Outscraper submit failed (${submit.status}): ${await submit.text()}`);
  const job = await submit.json();
  const results_location = job?.results_location;
  if (!results_location) throw new Error(`Outscraper missing results_location`);

  const start = Date.now();
  while (Date.now() - start < 60000) {
    const poll = await fetch(results_location, { headers: { 'X-API-KEY': key }, cache: 'no-store' });
    const text = await poll.text();
    if (poll.ok) {
      try {
        const json = JSON.parse(text);
        if (json?.status?.toLowerCase?.() === 'success' || Array.isArray(json)) return json;
      } catch {}
    }
    await sleep(1500);
  }
  throw new Error(`Outscraper poll timed out`);
}

async function fetchSerpApiReviewsByPlaceId(placeId: string, dateRange: string, serpKey: string) {
  const placeUrl = `https://serpapi.com/search.json?engine=google_maps_place&place_id=${encodeURIComponent(placeId)}&api_key=${serpKey}`;
  const pr = await fetch(placeUrl, { cache: 'no-store' });
  if (!pr.ok) throw new Error(`SerpApi place failed (${pr.status}): ${await pr.text()}`);
  const pjson = await pr.json();
  const data_id = pjson?.place_results?.data_id || pjson?.data_id || pjson?.place_id || '';

  const reviewsUrl = data_id
    ? `https://serpapi.com/search.json?engine=google_maps_reviews&data_id=${encodeURIComponent(data_id)}&hl=en&api_key=${serpKey}`
    : `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${encodeURIComponent(placeId)}&hl=en&api_key=${serpKey}`;

  const rr = await fetch(reviewsUrl, { cache: 'no-store' });
  if (!rr.ok) throw new Error(`SerpApi reviews failed (${rr.status}): ${await rr.text()}`);
  return rr.json();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      mapUrl,
      dateRange = '30',
      placeId: incomingPlaceId,
      exportPdf,
      result,
      peekResolve,
      provider, // new field
    } = body || {};

    const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY || '';
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
    const SERPAPI_KEY = process.env.SERPAPI_KEY || '';

    let effectivePlaceId = incomingPlaceId;
    if (!effectivePlaceId && mapUrl) {
      const rr = await serverResolvePlaceId(mapUrl);
      if (rr.placeId) effectivePlaceId = rr.placeId;
    }
    if (!effectivePlaceId) return NextResponse.json({ error: 'Could not resolve Google place_id' }, { status: 400 });

    if (peekResolve) return NextResponse.json({ resolved: { placeId: effectivePlaceId, queryParam: `place_id:${effectivePlaceId}` } });

    let reviews: string[] = [];

    if (provider === 'serp' && SERPAPI_KEY) {
      try {
        const sjson = await fetchSerpApiReviewsByPlaceId(effectivePlaceId, dateRange, SERPAPI_KEY);
        reviews = sanitizeReviews(sjson);
      } catch {}
    } else {
      if (OUTSCRAPER_API_KEY) {
        try {
          const outJson = await fetchOutscraperReviews(effectivePlaceId, dateRange, OUTSCRAPER_API_KEY);
          reviews = sanitizeReviews(outJson);
        } catch {
          reviews = [];
        }
      }
      if (!reviews.length && SERPAPI_KEY) {
        try {
          const sjson = await fetchSerpApiReviewsByPlaceId(effectivePlaceId, dateRange, SERPAPI_KEY);
          reviews = sanitizeReviews(sjson);
        } catch {}
      }
    }

    if (!reviews.length) return NextResponse.json({ error: 'No reviews found (both providers empty or error).' }, { status: 404 });

    const analysis = await analyzeWithAI(OPENAI_API_KEY, reviews);
    return NextResponse.json({ resolved: { placeId: effectivePlaceId, queryParam: `place_id:${effectivePlaceId}` }, reviews, analysis });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected server error' }, { status: 500 });
  }
}
