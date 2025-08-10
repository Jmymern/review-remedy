// app/api/analyze-reviews/route.ts
import { NextResponse } from 'next/server';

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
  // Outscraper v3 shape: data[0].reviews[].review_text
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first?.reviews) {
      return first.reviews
        .map((r: any) => r?.review_text || r?.text || '')
        .filter(Boolean);
    }
  }
  // SerpApi shapes
  if (raw?.reviews && Array.isArray(raw.reviews)) {
    return raw.reviews.map((r: any) => r?.snippet || r?.text || r?.review_text || '').filter(Boolean);
  }
  return [];
}

// ---- AI call (OpenAI) ----
async function analyzeWithAI(OPENAI_API_KEY: string, reviews: string[]) {
  const prompt = `
You are Review Remedy. Analyze these customer reviews and produce:
1) Top 5 Positives (short bullet points)
2) Top 5 Negatives (short bullet points)
3) Action Steps (5–8 short bullets businesses can act on)
4) One-sentence Summary

REVIEWS:
${reviews.map((r) => `- ${r}`).join('\n')}
`.trim();

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

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI error (${r.status}): ${t}`);
  }
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
    .split('\n')
    .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  const negatives = getSection('Top 5 Negatives', 'Action Steps')
    .split('\n')
    .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  const actions = getSection('Action Steps', 'Summary')
    .split('\n')
    .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 8);

  const summary =
    getSection('Summary').split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';

  return { positives, negatives, actions, summary };
}

// ---- Try to resolve place_id on server if not provided ----
async function serverResolvePlaceId(input: string): Promise<ResolveResp> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { error: 'Missing GOOGLE_MAPS_API_KEY' };

  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(input)}` +
    `&inputtype=textquery&fields=place_id,name&key=${key}`;

  const r = await fetch(url, { cache: 'no-store' });
  const data = await r.json();
  if (!data?.candidates?.length) return { error: 'Could not resolve place_id' };
  const { place_id: placeId, name } = data.candidates[0];
  return { normalizedUrl: input, placeId, name };
}

// ---- Outscraper cloud flow: submit + poll ----
async function fetchOutscraperReviews(placeId: string, dateRange: string, key: string) {
  // Submit job
  const submitUrl =
    `https://api.app.outscraper.com/maps/reviews-v3?` +
    `query=${encodeURIComponent(`place_id:${placeId}`)}&` +
    `reviewsLimit=80&` +
    `reviewsPeriod=${encodeURIComponent(dateRange)}`;

  const submit = await fetch(submitUrl, {
    headers: { 'X-API-KEY': key },
    cache: 'no-store',
  });

  if (!submit.ok) {
    const t = await submit.text();
    throw new Error(`Outscraper submit failed (${submit.status}): ${t}`);
  }

  const job = await submit.json();
  const results_location = job?.results_location;
  if (!results_location) {
    throw new Error(`Outscraper did not return results_location. Raw: ${JSON.stringify(job)}`);
  }

  // Poll results
  const start = Date.now();
  const timeoutMs = 60_000; // 60s
  let lastText = '';

  while (Date.now() - start < timeoutMs) {
    const poll = await fetch(results_location, {
      headers: { 'X-API-KEY': key },
      cache: 'no-store',
    });
    lastText = await poll.text();

    // 200 OK with JSON?
    if (poll.ok) {
      try {
        const json = JSON.parse(lastText);
        // Outscraper returns { status:'Success', data:[...] } when done
        if (json?.status?.toLowerCase?.() === 'success' || Array.isArray(json)) {
          return json;
        }
        // sometimes returns array data directly
        const maybe = sanitizeReviews(json);
        if (maybe.length) return json;
      } catch {
        // not JSON yet, keep polling
      }
    }

    await sleep(1500);
  }

  throw new Error(`Outscraper poll timed out. Last response: ${lastText.slice(0, 400)}`);
}

// ---- SerpApi fallback ----
async function fetchSerpApiReviewsByPlaceId(placeId: string, dateRange: string, serpKey: string) {
  // Step 1: get place (to obtain data_id if needed)
  const placeUrl = `https://serpapi.com/search.json?engine=google_maps_place&place_id=${encodeURIComponent(
    placeId
  )}&api_key=${serpKey}`;

  const pr = await fetch(placeUrl, { cache: 'no-store' });
  if (!pr.ok) {
    const t = await pr.text();
    throw new Error(`SerpApi place failed (${pr.status}): ${t}`);
  }
  const pjson = await pr.json();
  const data_id =
    pjson?.place_results?.data_id ||
    pjson?.data_id ||
    pjson?.place_id || // try fallbacks
    '';

  // Step 2: reviews by data_id (preferred) or place_id
  let reviewsUrl = '';
  if (data_id) {
    reviewsUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&data_id=${encodeURIComponent(
      data_id
    )}&hl=en&api_key=${serpKey}`;
  } else {
    reviewsUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${encodeURIComponent(
      placeId
    )}&hl=en&api_key=${serpKey}`;
  }

  const rr = await fetch(reviewsUrl, { cache: 'no-store' });
  if (!rr.ok) {
    const t = await rr.text();
    throw new Error(`SerpApi reviews failed (${rr.status}): ${t}`);
  }
  const rjson = await rr.json();
  return rjson;
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
    } = body || {};

    // PDF export only path
    if (exportPdf && result) {
      const lines: string[] = [];
      lines.push(`Review Remedy — AI Report`);
      lines.push('');
      if (result.analysis?.summary) lines.push(`Summary: ${result.analysis.summary}`, '');
      lines.push('Top 5 Positives:');
      (result.analysis?.positives || []).forEach((p: string) => lines.push(`- ${p}`));
      lines.push('');
      lines.push('Top 5 Negatives:');
      (result.analysis?.negatives || []).forEach((n: string) => lines.push(`- ${n}`));
      lines.push('');
      lines.push('Action Steps:');
      (result.analysis?.actions || []).forEach((a: string) => lines.push(`- ${a}`));
      lines.push('');
      lines.push('Reviews:');
      (result.reviews || []).slice(0, 40).forEach((rv: string) => lines.push(`- ${rv}`));

      const header = `%PDF-1.1\n`;
      const content = `1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
4 0 obj <</Length ${lines.join('\n').length + 91}>> stream
BT /F1 12 Tf 72 720 Td (${lines
        .join('\\n')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')}) Tj ET
endstream endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000069 00000 n 
0000000125 00000 n 
0000000346 00000 n 
0000000543 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
612
%%EOF`;
      const pdf = header + content;
      const pdfBytes = new TextEncoder().encode(pdf);
      return new Response(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="review-remedy-report.pdf"',
        },
      });
    }

    const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
    const SERPAPI_KEY = process.env.SERPAPI_KEY || '';

    // Resolve place_id
    let effectivePlaceId = incomingPlaceId as string | undefined;
    if (!effectivePlaceId && mapUrl) {
      // try our own resolver endpoint (keeps behavior consistent with UI)
      try {
        const rr = await serverResolvePlaceId(mapUrl);
        if (rr.placeId) effectivePlaceId = rr.placeId;
      } catch {/* ignore */}
    }

    if (!effectivePlaceId) {
      return NextResponse.json(
        { error: 'Could not resolve Google place_id from input.' },
        { status: 400 }
      );
    }

    if (peekResolve) {
      return NextResponse.json({ resolved: { placeId: effectivePlaceId, queryParam: `place_id:${effectivePlaceId}` } });
    }

    let reviews: string[] = [];

    // ---- Try Outscraper cloud first (if key present) ----
    if (OUTSCRAPER_API_KEY) {
      try {
        const outJson = await fetchOutscraperReviews(effectivePlaceId, dateRange, OUTSCRAPER_API_KEY);
        reviews = sanitizeReviews(outJson);
      } catch (e: any) {
        // fall through to SerpApi
        reviews = [];
      }
    }

    // ---- Fallback to SerpApi if needed ----
    if (!reviews.length && SERPAPI_KEY) {
      try {
        const sjson = await fetchSerpApiReviewsByPlaceId(effectivePlaceId, dateRange, SERPAPI_KEY);
        reviews = sanitizeReviews(sjson);
      } catch (e: any) {
        // still nothing; we’ll return a friendly error below
      }
    }

    if (!reviews.length) {
      return NextResponse.json(
        { error: 'No reviews found for that business/timeframe (both providers returned empty or errors).' },
        { status: 404 }
      );
    }

    // Run AI analysis
    const analysis = await analyzeWithAI(OPENAI_API_KEY, reviews);

    return NextResponse.json({
      resolved: { placeId: effectivePlaceId, queryParam: `place_id:${effectivePlaceId}` },
      reviews,
      analysis,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Unexpected server error' },
      { status: 500 }
    );
  }
}
