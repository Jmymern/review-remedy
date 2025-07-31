import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ---- Optional: OpenAI (only used if key is present)
let openai: any = null;
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
if (OPENAI_KEY) {
  try {
    // openai v4 SDK
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OpenAI } = require('openai');
    openai = new OpenAI({ apiKey: OPENAI_KEY });
  } catch {
    openai = null;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERPAPI_KEY = process.env.SERPAPI_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false },
});

// -------------------- helpers --------------------
function jsonOk(data: Record<string, any>, code = 200) {
  return NextResponse.json({ ok: true, ...data }, { status: code, headers: { 'Cache-Control': 'no-store' } });
}
function jsonError(message: string, extra: Record<string, any> = {}, code = 500) {
  return NextResponse.json({ ok: false, message, ...extra }, { status: code, headers: { 'Cache-Control': 'no-store' } });
}

// Very forgiving check for Google Maps URLs
function looksLikeGmaps(url: string) {
  const u = (url || '').trim();
  return u.includes('google.com/maps') || u.includes('maps.app.goo.gl');
}

// Try to resolve a SerpAPI data_id for the given Google Maps URL
async function serpapiResolveDataId(googleMapsUrl: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      engine: 'google_maps',
      google_maps_url: googleMapsUrl,
      api_key: SERPAPI_KEY,
      hl: 'en',
    });
    const url = `https://serpapi.com/search.json?${params.toString()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();

    // Common locations for data_id
    const dataId =
      json?.place_results?.data_id ||
      json?.place_results?.dataId ||
      json?.place_results?.place_id ||
      json?.place_results?.gps_coordinates?.place_id ||
      json?.place_results?.cid ||
      null;

    return dataId ? String(dataId) : null;
  } catch {
    return null;
  }
}

// Fetch reviews via SerpAPI using data_id
async function serpapiFetchReviewsByDataId(dataId: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      engine: 'google_maps_reviews',
      data_id: dataId,
      api_key: SERPAPI_KEY,
      hl: 'en',
      sort: 'newest',
    });
    const url = `https://serpapi.com/search.json?${params.toString()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();

    const reviews: any[] =
      json?.reviews ||
      json?.serpapi_pagination?.reviews ||
      [];

    // Extract the text field(s)
    const texts = reviews
      .map((r: any) => r?.snippet || r?.text || r?.review_text || r?.body || '')
      .filter((t: any) => typeof t === 'string' && t.trim().length > 0);

    return texts;
  } catch {
    return [];
  }
}

// Heuristic fallback: split long text into "reviews" (keeps the app working even without SerpAPI)
function fallbackExtractReviewsFromHtml(html: string): string[] {
  const cleaned = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  // Make 8 short "reviews" as a last resort
  const chunks: string[] = [];
  const words = cleaned.split(' ');
  for (let i = 0; i < words.length && chunks.length < 8; i += 30) {
    chunks.push(words.slice(i, i + 30).join(' '));
  }
  return chunks;
}

type Summary = {
  positives: string[];
  negatives: string[];
  suggestions: string;
};

// Basic non‑AI summary if OPENAI is not set
function heuristicSummary(reviews: string[]): Summary {
  const text = reviews.join(' ').toLowerCase();
  const posKw = ['friendly', 'clean', 'helpful', 'professional', 'fast', 'quick', 'knowledgeable', 'best', 'great'];
  const negKw = ['wait', 'rude', 'dirty', 'expensive', 'slow', 'confusing', 'late', 'bad', 'poor'];

  const score = (kw: string[]) =>
    kw
      .map((k) => ({ k, c: (text.match(new RegExp(`\\b${k}\\b`, 'g')) || []).length }))
      .filter((x) => x.c > 0)
      .sort((a, b) => b.c - a.c)
      .slice(0, 5)
      .map((x) => `${x.k} (${x.c})`);

  const positives = score(posKw);
  const negatives = score(negKw);

  const suggestions = [
    positives.length ? 'Double down on what people praise most.' : '',
    negatives.length ? 'Address repeat complaints first; publish visible fixes.' : '',
    'Improve review response time; acknowledge and close the loop.',
  ]
    .filter(Boolean)
    .join('\n');

  return { positives, negatives, suggestions };
}

async function openaiSummary(business: string | null, reviews: string[]): Promise<Summary> {
  // Guard: no client available
  if (!openai) return heuristicSummary(reviews);

  const system = `You are an analyst that reads customer reviews and returns a concise JSON summary with:
- "positives": top 5 recurring positive themes (short phrases)
- "negatives": top 5 recurring complaints (short phrases)
- "suggestions": 2-4 sentence action plan that addresses negatives and protects positives
Return ONLY valid JSON.`;

  const user = `Business: ${business || 'Unknown'}
Reviews (latest first):
${reviews.map((r, i) => `- ${r}`).join('\n')}

Return JSON like:
{"positives":["..."],"negatives":["..."],"suggestions":"..."}
`;

  // Use chat.completions for wide compatibility
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const text = resp?.choices?.[0]?.message?.content || '';
  try {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const jsonStr = firstBrace >= 0 ? text.slice(firstBrace, lastBrace + 1) : text;
    const parsed = JSON.parse(jsonStr);

    const positives: string[] = Array.isArray(parsed?.positives) ? parsed.positives.map(String).slice(0, 5) : [];
    const negatives: string[] = Array.isArray(parsed?.negatives) ? parsed.negatives.map(String).slice(0, 5) : [];
    const suggestions: string = typeof parsed?.suggestions === 'string' ? parsed.suggestions : '';

    // If parsing failed to produce arrays, fall back
    if (positives.length === 0 && negatives.length === 0 && !suggestions) {
      return heuristicSummary(reviews);
    }
    return { positives, negatives, suggestions };
  } catch {
    return heuristicSummary(reviews);
  }
}

// -------------------- main handler --------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const business_url = (body?.business_url || '').toString().trim();
    const business_name = body?.business_name ? String(body.business_name) : null;
    const time_range = body?.time_range ? String(body.time_range) : '90';

    if (!business_url || !looksLikeGmaps(business_url)) {
      return jsonError('Please provide a valid Google Maps link (Share → Copy link).', { field: 'business_url' }, 400);
    }

    // 1) Create initial row (processing)
    const { data: inserted, error: insertErr } = await supabase
      .from('reports')
      .insert({
        business_url,
        business_name,
        time_range,
        status: 'processing',
        error: null,
        raw_reviews: null,
      })
      .select('id')
      .single();

    if (insertErr || !inserted?.id) {
      return jsonError('DB insert failed', { db_error: String(insertErr) }, 500);
    }
    const rowId = inserted.id as string;

    // 2) Fetch reviews
    let reviews: string[] = [];
    let providerUsed: 'serpapi' | 'fallback' = 'fallback';

    if (SERPAPI_KEY) {
      const dataId = await serpapiResolveDataId(business_url);
      if (dataId) {
        const serpReviews = await serpapiFetchReviewsByDataId(dataId);
        if (Array.isArray(serpReviews) && serpReviews.length > 0) {
          reviews = serpReviews;
          providerUsed = 'serpapi';
        }
      }
    }

    // If still empty, do a best-effort fallback (keeps the pipeline alive)
    if (reviews.length === 0) {
      try {
        const htmlRes = await fetch(business_url, { method: 'GET', cache: 'no-store' });
        const html = htmlRes.ok ? await htmlRes.text() : '';
        const fallback = fallbackExtractReviewsFromHtml(html);
        if (fallback.length > 0) {
          reviews = fallback;
          providerUsed = 'fallback';
        }
      } catch {
        // swallow
      }
    }

    if (reviews.length === 0) {
      // Update row error
      await supabase
        .from('reports')
        .update({ status: 'error', error: 'No reviews fetched', raw_reviews: [] })
        .eq('id', rowId);
      return jsonError('No reviews fetched from Google', { source: providerUsed }, 502);
    }

    // Limit how much we send to OpenAI (keep costs fast/low)
    const limited = reviews.slice(0, 50);

    // 3) Summarize
    const summary = await openaiSummary(business_name, limited);

    // 4) Persist final result
    const { error: upsertErr } = await supabase
      .from('reports')
      .update({
        status: 'completed',
        error: null,
        business_name,
        business_url,
        time_range,
        positives: summary.positives,
        negatives: summary.negatives,
        suggestions: summary.suggestions,
        raw_reviews: limited, // store texts (jsonb)
      })
      .eq('id', rowId);

    if (upsertErr) {
      return jsonError('DB update failed', { db_error: String(upsertErr) }, 500);
    }

    return jsonOk({
      id: rowId,
      business_name,
      business_url,
      time_range,
      positives: summary.positives,
      negatives: summary.negatives,
      suggestions: summary.suggestions,
      source: providerUsed,
      created_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return jsonError('Unexpected server error', { reason: String(e?.message || e) }, 500);
  }
}
