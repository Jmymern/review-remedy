import { NextResponse } from 'next/server';

const OUTSCRAPER_KEY = process.env.OUTSCRAPER_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

function extractFromIframe(html: string): string | null {
  const m = html.match(/<iframe[^>]+src="([^"]+)"/i);
  return m?.[1] || null;
}
function extractPlaceIdFromUrl(url: string): string | null {
  const m = url.match(/[?&]placeid=([^&]+)/i) || url.match(/place_id=([^&]+)/i);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}
function normalizeUserInput(input: string): string {
  const trimmed = input.trim();
  const iframeSrc = /<iframe/i.test(trimmed) ? extractFromIframe(trimmed) : null;
  return iframeSrc || trimmed;
}

async function resolvePlaceId(userInput: string): Promise<{ placeId?: string; name?: string; normalizedUrl: string; }> {
  const normalizedUrl = normalizeUserInput(userInput);

  // if the URL already carries place_id, use it
  const direct = extractPlaceIdFromUrl(normalizedUrl);
  if (direct) return { placeId: direct, name: undefined, normalizedUrl };

  if (!GOOGLE_KEY) return { normalizedUrl };

  // Ask Places "Find Place From Text"
  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
    `input=${encodeURIComponent(normalizedUrl)}` +
    `&inputtype=textquery&fields=place_id,name&key=${GOOGLE_KEY}`;

  const r = await fetch(url, { cache: 'no-store' });
  const data = await r.json();
  const placeId = data?.candidates?.[0]?.place_id;
  const name = data?.candidates?.[0]?.name;
  return { placeId, name, normalizedUrl };
}

async function submitOutscraper(placeId: string, period: string, limit = 80) {
  // async request submit (this returns Pending + results_location)
  const submitUrl =
    `https://api.app.outscraper.com/maps/reviews-v3` +
    `?query=${encodeURIComponent(`place_id:${placeId}`)}` +
    `&reviewsPeriod=${encodeURIComponent(period)}` +
    `&reviewsLimit=${limit}`;

  const s = await fetch(submitUrl, {
    headers: { 'X-API-KEY': OUTSCRAPER_KEY! },
    cache: 'no-store',
  });

  if (!s.ok) {
    const txt = await s.text();
    throw new Error(`Outscraper submit failed (${s.status}): ${txt}`);
  }

  const body = await s.json();
  const results_location = body?.results_location;
  if (!results_location) throw new Error(`Outscraper didn't return results_location`);
  return results_location as string;
}

async function pollOutscraper(results_location: string, maxWaitMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const r = await fetch(results_location, {
      headers: { 'X-API-KEY': OUTSCRAPER_KEY! },
      cache: 'no-store',
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Outscraper poll failed (${r.status}): ${txt}`);
    }
    const json = await r.json();
    const status = json?.status;
    if (status === 'Success') return json?.data;
    if (status && /expired|failed/i.test(status)) {
      throw new Error(`Outscraper status: ${status}`);
    }
    await sleep(1500);
  }
  throw new Error('Outscraper timeout waiting for results');
}

async function fallbackGooglePlaceReviews(placeId: string): Promise<string[]> {
  // Fallback: Google Place Details (limited reviews count, but avoids a dead end)
  if (!GOOGLE_KEY) return [];
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}` +
    `&fields=review&key=${GOOGLE_KEY}`;
  const r = await fetch(url, { cache: 'no-store' });
  const j = await r.json();
  const reviews = j?.result?.reviews || [];
  return reviews.map((rv: any) => rv?.text).filter(Boolean);
}

function buildPrompt(reviews: string) {
  return `
You are Review Remedy. Analyze these customer reviews and produce:
Top 5 Positives: (one short bullet per line)
Top 5 Negatives: (one short bullet per line)
Action Steps: (5–8 short bullets)
Summary: (one sentence)

REVIEWS:
${reviews}
`.trim();
}

function parseList(src: string, startLabel: string, endLabel?: string, max = 5) {
  const startIdx = src.toLowerCase().indexOf(startLabel.toLowerCase());
  let section = '';
  if (startIdx >= 0) {
    const from = startIdx + startLabel.length;
    if (endLabel) {
      const endIdx = src.toLowerCase().indexOf(endLabel.toLowerCase(), from);
      section = (endIdx >= 0 ? src.slice(from, endIdx) : src.slice(from)).trim();
    } else {
      section = src.slice(from).trim();
    }
  }
  return section
    .split('\n')
    .map(l => l.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, max);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { mapUrl, dateRange = '30', peekResolve, exportPdf, result } = body || {};

    // quick resolve-only path for the UI “shows place_id while typing”
    if (peekResolve) {
      const resolved = await resolvePlaceId(mapUrl || '');
      return NextResponse.json({ resolved });
    }

    // PDF export path
    if (exportPdf && result) {
      const lines: string[] = [];
      lines.push(`Review Remedy — AI Report`);
      lines.push('');
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
      (result.reviews || []).slice(0, 50).forEach((rv: string) => lines.push(`- ${rv}`));

      const header = `%PDF-1.1\n`;
      const content =
`1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
4 0 obj <</Length ${lines.join('\\n').length + 91}>> stream
BT /F1 10 Tf 40 740 Td (${lines.join('\\n').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}) Tj ET
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
      const pdf = new TextEncoder().encode(header + content);
      return new Response(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="review-remedy-report.pdf"',
        },
      });
    }

    if (!mapUrl) return NextResponse.json({ error: 'Missing mapUrl' }, { status: 400 });
    if (!OUTSCRAPER_KEY) return NextResponse.json({ error: 'Missing OUTSCRAPER_API_KEY' }, { status: 500 });
    if (!OPENAI_KEY) return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });

    // 1) resolve place_id first
    const resolved = await resolvePlaceId(mapUrl);
    const placeId = resolved.placeId;
    if (!placeId) {
      return NextResponse.json({ error: 'Could not resolve a Google place_id from that input.' }, { status: 400 });
    }

    // 2) Outscraper async flow
    let reviews: string[] = [];
    try {
      const results_location = await submitOutscraper(placeId, String(dateRange || '30'));
      const data = await pollOutscraper(results_location);
      // Try common shapes
      const arr = Array.isArray(data) ? data : data?.data || [];
      const first = Array.isArray(arr) ? arr[0] : null;
      reviews =
        first?.reviews?.map((r: any) => r?.review_text).filter(Boolean) ||
        arr?.flatMap((x: any) => x?.reviews?.map((r: any) => r?.review_text)).filter(Boolean) ||
        [];
    } catch (e: any) {
      // 3) Fallback to Google Place Details if Outscraper fails
      const fb = await fallbackGooglePlaceReviews(placeId);
      reviews = fb;
      if (!reviews.length) throw e; // still throw original if we truly have nothing
    }

    if (reviews.length === 0) {
      return NextResponse.json({ error: 'No reviews found for that business/timeframe.' }, { status: 404 });
    }

    // 4) AI analysis
    const prompt = buildPrompt(reviews.map(r => `- ${r}`).join('\n'));
    const ai = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      }),
    });
    if (!ai.ok) {
      const txt = await ai.text();
      return NextResponse.json({ error: `AI error (${ai.status}): ${txt}` }, { status: 502 });
    }
    const aiData = await ai.json();
    const text: string = aiData?.choices?.[0]?.message?.content || '';

    const positives = parseList(text, 'Top 5 Positives', 'Top 5 Negatives', 5);
    const negatives = parseList(text, 'Top 5 Negatives', 'Action Steps', 5);
    const actions   = parseList(text, 'Action Steps', 'Summary', 8);
    const summary   = parseList(text, 'Summary', undefined, 1)[0] || '';

    return NextResponse.json({
      resolved: { placeId, queryParam: `place_id:${placeId}` },
      reviews,
      analysis: { positives, negatives, actions, summary },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected server error' }, { status: 500 });
  }
}
