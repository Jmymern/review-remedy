import { NextResponse } from 'next/server';

// --- tiny PDF generator (no deps) ---
function makeSimplePdf(text: string): Uint8Array {
  // minimal PDF with single text block (ASCII only)
  // This is intentionally simple. For fancy styling, switch to a lib later.
  const header = `%PDF-1.1\n`;
  const content = `1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
4 0 obj <</Length ${text.length + 91}>> stream
BT /F1 12 Tf 72 720 Td (${text.replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj ET
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
  return new TextEncoder().encode(pdf);
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3, delayMs = 800) {
  let err: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, init);
      if (r.ok) return r;
      err = new Error(`HTTP ${r.status} ${r.statusText}`);
    } catch (e) {
      err = e;
    }
    await new Promise((res) => setTimeout(res, delayMs * (i + 1)));
  }
  throw err;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mapUrl, dateRange, placeId, exportPdf, result } = body || {};
    const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

    // PDF export path (skip API calls)
    if (exportPdf && result) {
      const lines: string[] = [];
      lines.push(`Review Remedy — AI Report`);
      lines.push(``);
      if (result.analysis?.summary) {
        lines.push(`Summary: ${result.analysis.summary}`);
        lines.push('');
      }
      lines.push(`Top 5 Positives:`);
      (result.analysis?.positives || []).forEach((p: string) => lines.push(`- ${p}`));
      lines.push('');
      lines.push(`Top 5 Negatives:`);
      (result.analysis?.negatives || []).forEach((n: string) => lines.push(`- ${n}`));
      lines.push('');
      lines.push(`Action Steps:`);
      (result.analysis?.actions || []).forEach((a: string) => lines.push(`- ${a}`));
      lines.push('');
      lines.push(`Reviews:`);
      (result.reviews || []).slice(0, 40).forEach((rv: string) => lines.push(`- ${rv}`));

      const pdfBytes = makeSimplePdf(lines.join('\\n'));
      return new Response(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="review-remedy-report.pdf"',
        },
      });
    }

    if (!OUTSCRAPER_API_KEY) {
      return NextResponse.json({ error: 'Missing OUTSCRAPER_API_KEY' }, { status: 500 });
    }
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
    }

    // Try to use provided placeId first
    let effectivePlaceId = placeId as string | undefined;

    // If not provided, resolve one quickly through Places API (server-side)
    if (!effectivePlaceId && mapUrl && GOOGLE_MAPS_API_KEY) {
      const findUrl =
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
        `?input=${encodeURIComponent(mapUrl)}` +
        `&inputtype=textquery&fields=place_id,name&key=${GOOGLE_MAPS_API_KEY}`;
      const p = await fetchWithRetry(findUrl, { cache: 'no-store' });
      const pd = await p.json();
      if (pd?.candidates?.[0]?.place_id) {
        effectivePlaceId = pd.candidates[0].place_id;
      }
    }

    // Build Outscraper query: prefer place_id if available
    let queryParam: string;
    if (effectivePlaceId) {
      // Many Outscraper endpoints accept "query=place_id:<id>"
      queryParam = `place_id:${effectivePlaceId}`;
    } else {
      // last resort: raw mapUrl as text
      queryParam = mapUrl;
    }

    // Call Outscraper (v3) — adjust params as needed
    const outscraperUrl =
      `https://api.app.outscraper.com/maps/reviews-v3?` +
      `query=${encodeURIComponent(queryParam || '')}` +
      `&reviewsLimit=80&reviewsPeriod=${encodeURIComponent(dateRange || '30')}`;

    const out = await fetchWithRetry(outscraperUrl, {
      headers: { 'X-API-KEY': OUTSCRAPER_API_KEY },
      cache: 'no-store',
    });

    if (!out.ok) {
      const txt = await out.text();
      return NextResponse.json(
        { error: `Outscraper error (${out.status}): ${txt}` },
        { status: 502 }
      );
    }

    const outJson = await out.json();
    // Usually the data is in the first item -> reviews[].review_text
    const reviews: string[] =
      outJson?.[0]?.reviews?.map((r: any) => r?.review_text).filter(Boolean) || [];

    if (!reviews.length) {
      return NextResponse.json(
        { error: 'No reviews found for that business/timeframe.' },
        { status: 404 }
      );
    }

    // --- AI Analysis ---
    const prompt = `
You are Review Remedy. Analyze these customer reviews and produce:
1) Top 5 Positives (short bullet points)
2) Top 5 Negatives (short bullet points)
3) Action Steps (5–8 short bullets businesses can act on)
4) One-sentence Summary

REVIEWS:
${reviews.map((r) => `- ${r}`).join('\n')}
`.trim();

    const ai = await fetchWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
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
      }
    );

    if (!ai.ok) {
      const txt = await ai.text();
      return NextResponse.json(
        { error: `AI error (${ai.status}): ${txt}` },
        { status: 502 }
      );
    }

    const aiData = await ai.json();
    const text: string = aiData?.choices?.[0]?.message?.content || '';

    // Parse sections safely
    function sliceBetween(src: string, start: string, end?: string) {
      const s = src.indexOf(start);
      if (s < 0) return '';
      const from = s + start.length;
      if (!end) return src.slice(from).trim();
      const e = src.indexOf(end, from);
      return (e < 0 ? src.slice(from) : src.slice(from, e)).trim();
    }

    const positives = sliceBetween(text, 'Top 5 Positives', 'Top 5 Negatives')
      .split('\n')
      .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 5);

    const negatives = sliceBetween(text, 'Top 5 Negatives', 'Action Steps')
      .split('\n')
      .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 5);

    const actions = sliceBetween(text, 'Action Steps', 'Summary')
      .split('\n')
      .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 8);

    const summary =
      sliceBetween(text, 'Summary').split('\n').map((s: string) => s.trim()).filter(Boolean)[0] ||
      '';

    return NextResponse.json({
      resolved: { placeId: effectivePlaceId || null, queryParam },
      reviews,
      analysis: { positives, negatives, actions, summary },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Unexpected server error' },
      { status: 500 }
    );
  }
}
