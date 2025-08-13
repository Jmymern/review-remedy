// app/api/create-report/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type CreateReportBody = { placeInput: string; days?: number };

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

async function resolvePlaceId(placeInput: string): Promise<{ placeId?: string; name?: string; error?: string }> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return { error: 'GOOGLE_MAPS_API_KEY is missing' };

    console.log('[resolvePlaceId] Resolving:', placeInput);

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
      console.error('[resolvePlaceId] Google API error:', txt);
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

async function outscraperSubmitAndPoll(submitUrl: string) {
  const key = process.env.OUTSCRAPER_API_KEY;
  if (!key) throw new Error('OUTSCRAPER_API_KEY is missing');

  console.log('[Outscraper] URL:', submitUrl);

  const submit = await fetch(submitUrl, {
    headers: { 'X-API-KEY': key },
    cache: 'no-store',
  });

  if (!submit.ok) {
    const txt = await submit.text();
    console.error('[Outscraper] Submit error:', submit.status, txt);
    throw new Error(`Outscraper submit failed (${submit.status}): ${txt}`);
  }

  const job = await submit.json();
  console.log('[Outscraper] Job response:', JSON.stringify(job, null, 2));

  if (job?.data) return job;
  const resultsLoc = job?.results_location;
  if (!resultsLoc) throw new Error('Outscraper missing results_location');

  const start = Date.now();
  while (Date.now() - start < 60000) {
    const poll = await fetch(resultsLoc, { headers: { 'X-API-KEY': key }, cache: 'no-store' });
    const txt = await poll.text();
    if (poll.ok) {
      try {
        const json = JSON.parse(txt);
        console.log('[Outscraper] Poll response:', JSON.stringify(json, null, 2));
        if (json?.status?.toLowerCase?.() === 'success' || Array.isArray(json)) return json;
      } catch { /* keep polling */ }
    }
    await sleep(1500);
  }
  throw new Error('Outscraper poll timed out');
}

async function fetchWithFallback(placeId: string | null, query: string, days: number) {
  try {
    if (placeId) {
      return await outscraperSubmitAndPoll(
        `https://api.app.outscraper.com/api/google_maps/reviews?place_id=${encodeURIComponent(placeId)}&reviews_limit=200&sort=newest&ignore_empty=1&language=en&reviews_period=${days}d`
      );
    }
    // no placeId → query mode
    return await outscraperSubmitAndPoll(
      `https://api.app.outscraper.com/api/google_maps/reviews?query=${encodeURIComponent(query)}&reviews_limit=200&sort=newest&ignore_empty=1&language=en&reviews_period=${days}d`
    );
  } catch (err) {
    // fallback: try query if placeId path failed
    if (placeId) {
      console.warn('[fetchWithFallback] placeId failed, retrying with query…', err);
      return await outscraperSubmitAndPoll(
        `https://api.app.outscraper.com/api/google_maps/reviews?query=${encodeURIComponent(query)}&reviews_limit=200&sort=newest&ignore_empty=1&language=en&reviews_period=${days}d`
      );
    }
    throw err;
  }
}

async function analyzeReviewsWithAI(reviews: string[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null; // optional; don’t fail the request

  console.log(`[AI] Sending ${reviews.length} reviews to OpenAI`);

  const prompt = `
You are an expert business review analyst. From the following customer reviews, produce:

1) Top 5 recurring POSITIVE themes (each: short title – explanation)
2) Top 5 recurring NEGATIVE themes (each: short title – explanation)
3) Actionable improvement plan for the negatives (bullets)
4) Plan to keep and leverage the positives (bullets)

Return either structured JSON with keys {positives[], negatives[], improve[], keep[]} OR clear sections with bullets.

Reviews:
${reviews.join('\n')}
`.trim();

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a concise, practical review analyst.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('[AI] OpenAI error:', resp.status, txt);
    return null;
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return content || null;
}

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

    const raw = await fetchWithFallback(resolved.placeId || null, placeInput, days);
    const reviews = sanitizeReviews(raw);

    if (!reviews.length) {
      return NextResponse.json({ error: 'No reviews found' }, { status: 404 });
    }

    const aiAnalysis = await analyzeReviewsWithAI(reviews);

    return NextResponse.json({
      ok: true,
      placeId: resolved.placeId || null,
      placeName: resolved.name || '',
      days,
      reviewCount: reviews.length,
      reviews,
      aiAnalysis, // string or null
      source: resolved.placeId ? 'outscraper-placeId' : 'outscraper-query',
    });
  } catch (e: any) {
    console.error('[POST] Fatal error:', e);
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
