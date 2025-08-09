import { NextResponse } from 'next/server';

const OUTSCRAPER_BASE = 'https://api.app.outscraper.com';
const MAX_POLL_MS = 60_000; // stop after 60s
const POLL_INTERVAL_MS = 2500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep text for diagnostics */ }
  if (!r.ok) {
    throw new Error(
      `HTTP ${r.status} ${r.statusText}${json ? `: ${JSON.stringify(json)}` : `: ${text}`}`
    );
  }
  return json ?? {};
}

// Tiny, no‑dep PDF
function makeSimplePdf(text: string): Uint8Array {
  const header = `%PDF-1.1\n`;
  const safe = text.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content =
`1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
4 0 obj <</Length ${safe.length + 91}>> stream
BT /F1 12 Tf 72 720 Td (${safe}) Tj ET
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
  return new TextEncoder().encode(header + content);
}

function tryParsePlaceIdFromUrl(input: string): string | null {
  try {
    const u = new URL(input);
    // 1) place_id in query string?
    const pid = u.searchParams.get('query_place_id') || u.searchParams.get('place_id');
    if (pid) return pid;

    // 2) embedded in pb param (messy, heuristic)
    const pb = u.searchParams.get('pb');
    if (pb && pb.includes('!1s')) {
      // sometimes place_id is in there; not reliable, so we skip here
    }

    // 3) short link? (maps.app.goo.gl) -> no place_id inside; we’ll resolve later
    return null;
  } catch {
    return null;
  }
}

async function resolvePlaceId(input: string): Promise<string | null> {
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!GOOGLE_MAPS_API_KEY) return null;

  // If it already looks like a URL, try “find place from text” with the URL itself,
  // otherwise treat it as a plain business name.
  const looksLikeUrl = /^https?:\/\//i.test(input.trim());
  const query = looksLikeUrl ? input.trim() : `${input.trim()}`;

  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(query)}` +
    `&inputtype=textquery&fields=place_id,name,formatted_address` +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  const data = await fetchJson(url);
  return data?.candidates?.[0]?.place_id ?? null;
}

function buildOpenAiPrompt(reviews: string[]) {
  return `
You are Review Remedy. Analyze these customer reviews and produce exactly:

Top 5 Positives:
- short bullet
- short bullet
- short bullet
- short bullet
- short bullet

Top 5 Negatives:
- short bullet
- short bullet
- short bullet
- short bullet
- short bullet

Action Steps:
- 5–8 short, concrete, non-generic bullets businesses can act on.

Summary:
- One concise sentence.

REVIEWS:
${reviews.map((r) => `- ${r}`).join('\n')}
`.trim();
}

async function runOpenAiAnalysis(reviews: string[]) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildOpenAiPrompt(reviews) }],
      temperature: 0.4,
    }),
  });
  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content || '';

  const sliceBetween = (src: string, start: string, end?: string) => {
    const s = src.indexOf(start);
    if (s < 0) return '';
    const from = s + start.length;
    if (!end) return src.slice(from).trim();
    const e = src.indexOf(end, from);
    return (e < 0 ? src.slice(from) : src.slice(from, e)).trim();
  };

  const positives = sliceBetween(text, 'Top 5 Positives:', 'Top 5 Negatives:')
    .split('\n')
    .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  const negatives = sliceBetween(text, 'Top 5 Negatives:', 'Action Steps:')
    .split('\n')
    .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  const actions = sliceBetween(text, 'Action Steps:', 'Summary:')
    .split('\n')
    .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 8);

  const summary =
    sliceBetween(text, 'Summary:').split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';

  return { positives, negatives, actions, summary };
}

async function getReviewsFromGooglePlaces(placeId: string, max = 5) {
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}` +
    `&fields=reviews&key=${GOOGLE_MAPS_API_KEY}`;
  const data = await fetchJson(url);
  const reviews: string[] =
    data?.result?.reviews?.map((r: any) => r?.text).filter(Boolean).slice(0, max) || [];
  return reviews;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const {
    mapUrl = '',
    dateRange = '30',
    peekResolve = false,
    placeId: clientPlaceId,
    exportPdf = false,
    result,
  } = body || {};

  const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  // Export PDF without re-calling APIs
  if (exportPdf && result) {
    const lines: string[] = [];
    lines.push(`Review Remedy — AI Report`);
    lines.push('');
    if (result.analysis?.summary) {
      lines.push(`Summary: ${result.analysis.summary}`);
      lines.push('');
    }
    lines.push('Top 5 Positives:');
    (result.analysis?.positives || []).forEach((x: string) => lines.push(`- ${x}`));
    lines.push('');
    lines.push('Top 5 Negatives:');
    (result.analysis?.negatives || []).forEach((x: string) => lines.push(`- ${x}`));
    lines.push('');
    lines.push('Action Steps:');
    (result.analysis?.actions || []).forEach((x: string) => lines.push(`- ${x}`));
    lines.push('');
    lines.push('Reviews:');
    (result.reviews || []).slice(0, 40).forEach((x: string) => lines.push(`- ${x}`));

    const pdf = makeSimplePdf(lines.join('\n'));
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="review-remedy-report.pdf"',
      },
    });
  }

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  // Resolve place_id (URL or name)
  let placeId =
    clientPlaceId ||
    tryParsePlaceIdFromUrl(mapUrl) ||
    (GOOGLE_MAPS_API_KEY ? await resolvePlaceId(mapUrl) : null);

  if (peekResolve) {
    return NextResponse.json({ resolved: { placeId: placeId || null } });
  }

  // Prefer Outscraper if we have its key
  let reviews: string[] = [];
  let queryParam = '';

  if (OUTSCRAPER_API_KEY && placeId) {
    try {
      queryParam = `place_id:${placeId}`;
      const startUrl =
        `${OUTSCRAPER_BASE}/maps/reviews-v3?query=${encodeURIComponent(queryParam)}` +
        `&reviewsLimit=80&reviewsPeriod=${encodeURIComponent(dateRange)}`;

      const start = await fetch(startUrl, {
        headers: { 'X-API-KEY': OUTSCRAPER_API_KEY },
        cache: 'no-store',
      });

      // Some accounts may return directly with data array (sync).
      // Others return {status:"Pending", results_location: "..."} (async).
      const startJson = await start.json().catch(() => ({} as any));

      if (Array.isArray(startJson) && startJson[0]?.reviews) {
        reviews =
          startJson[0].reviews.map((r: any) => r?.review_text).filter(Boolean) || [];
      } else if (startJson?.results_location) {
        const pollUrl = startJson.results_location as string;
        const started = Date.now();
        while (Date.now() - started < MAX_POLL_MS) {
          await sleep(POLL_INTERVAL_MS);
          const poll = await fetchJson(pollUrl, {
            headers: { 'X-API-KEY': OUTSCRAPER_API_KEY },
            cache: 'no-store',
          });

          const status = (poll?.status || '').toLowerCase();
          if (status === 'success' || poll?.data) {
            const dataArr = poll?.data ?? poll?.result ?? poll;
            const arr = Array.isArray(dataArr) ? dataArr : [];
            reviews =
              arr?.[0]?.reviews?.map((r: any) => r?.review_text).filter(Boolean) || [];
            break;
          }

          if (status === 'error' || status === 'failed') {
            throw new Error(`Outscraper job failed: ${JSON.stringify(poll)}`);
          }
        }
      } else if (startJson?.status?.toLowerCase() === 'pending') {
        // No results_location? very rare; we’ll bail to fallback later
        throw new Error('Outscraper returned Pending without results_location.');
      }
    } catch (e: any) {
      // fall through to fallback
    }
  }

  // Fallback to Google Places Details (returns up to 5 reviews)
  if (!reviews.length && placeId && GOOGLE_MAPS_API_KEY) {
    reviews = await getReviewsFromGooglePlaces(placeId, 5);
  }

  if (!reviews.length) {
    return NextResponse.json(
      { error: 'No reviews found for that business/timeframe.' },
      { status: 404 }
    );
  }

  const analysis = await runOpenAiAnalysis(reviews);

  return NextResponse.json({
    resolved: { placeId: placeId || null, queryParam },
    reviews,
    analysis,
  });
}
