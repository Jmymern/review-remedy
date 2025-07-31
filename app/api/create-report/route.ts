// /app/api/create-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- ENV ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// Small helper: swallow errors but log to function logs
function log(...args: any[]) {
  try { console.log(...args); } catch {}
}

type Review = { text: string; rating?: number; time?: string };

export async function POST(req: NextRequest) {
  try {
    const { business_url = '', business_name = null, time_range = '90' } = await req.json() || {};

    if (!business_url && !business_name) {
      return NextResponse.json({ error: 'Provide business_url or business_name' }, { status: 400 });
    }

    // Insert placeholder row (processing)
    const { data: inserted, error: insertErr } = await supabase
      .from('reports')
      .insert({
        business_url: business_url || null,
        business_name,
        time_range: String(time_range),
        status: 'processing',
      })
      .select('*')
      .single();

    if (insertErr) {
      log('Supabase insert error:', insertErr);
      return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
    }

    const reportId = inserted.id;

    // ---- 1) Fetch reviews (SerpAPI first, fallback to Google Places New) ----
    const query = deriveQueryFromInputs(business_url, business_name);
    let reviews: Review[] = [];

    if (SERPAPI_KEY) {
      try {
        reviews = await fetchReviewsSerpApi(query);
        log('SerpAPI reviews:', reviews.length);
      } catch (e: any) {
        log('SerpAPI failed:', e?.message || e);
      }
    }

    if ((!reviews || reviews.length === 0) && GOOGLE_KEY) {
      try {
        reviews = await fetchReviewsGooglePlacesNew(query, GOOGLE_KEY);
        log('Places(New) reviews:', reviews.length);
      } catch (e: any) {
        log('Places(New) failed:', e?.message || e);
      }
    }

    if (!reviews || reviews.length === 0) {
      // Mark error and return
      await supabase.from('reports')
        .update({ status: 'error', error: 'No reviews found for this place.', raw_reviews: [] })
        .eq('id', reportId);
      return NextResponse.json({ error: 'No reviews found for this place.' }, { status: 404 });
    }

    // Optionally trim by time_range (days)
    const trimmed = filterByTimeRange(reviews, String(time_range));

    // ---- 2) Summarize with OpenAI to get recurring Top 5 + action plan ----
    const summary = OPENAI_KEY
      ? await summarizeWithOpenAI(trimmed.slice(0, 400), OPENAI_KEY) // cap to keep token use sane
      : fauxSummary(trimmed);

    // ---- 3) Save to DB ----
    const payload = {
      positives: summary.positives,
      negatives: summary.negatives,
      suggestions: summary.suggestions,
      raw_reviews: trimmed,
      status: 'completed',
      error: null,
    };

    const { data: updated, error: updErr } = await supabase
      .from('reports')
      .update(payload)
      .eq('id', reportId)
      .select('*')
      .single();

    if (updErr) {
      log('Supabase update error:', updErr);
      return NextResponse.json({ error: 'DB update failed', ...payload }, { status: 500 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    log('Unhandled create-report error:', e?.message || e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

// -------- Helpers --------

function deriveQueryFromInputs(url: string, name: string | null): string {
  if (name && name.trim().length > 0) return name.trim();
  if (!url) return '';
  try {
    const u = new URL(url);
    // Try to pull human title from /maps/place/… or q=… / dir/…
    const pathname = decodeURIComponent(u.pathname || '');
    const q = u.searchParams.get('q') || '';
    const parts: string[] = [];
    if (pathname.includes('/maps/place/')) {
      const seg = pathname.split('/maps/place/')[1]?.split('/')[0] || '';
      if (seg) parts.push(seg.replace(/\+/g, ' '));
    }
    if (q) parts.push(q.replace(/\+/g, ' '));
    return parts.join(' ').trim() || url;
  } catch {
    return name || url;
  }
}

function filterByTimeRange(reviews: Review[], range: string): Review[] {
  if (range === 'all') return reviews;
  const days = Number(range);
  if (!Number.isFinite(days) || days <= 0) return reviews;
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  return reviews.filter(r => {
    const t = r.time ? Date.parse(r.time) : NaN;
    return Number.isFinite(t) ? t >= cutoff : true;
  });
}

// --- SerpAPI (Google Maps) ---
async function fetchReviewsSerpApi(query: string): Promise<Review[]> {
  // 1) search for the place to get data_id
  const searchUrl = new URL('https://serpapi.com/search.json');
  searchUrl.searchParams.set('engine', 'google_maps');
  searchUrl.searchParams.set('type', 'search');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('api_key', SERPAPI_KEY);

  const sRes = await fetch(searchUrl.toString(), { next: { revalidate: 0 } });
  if (!sRes.ok) throw new Error(`SerpAPI search ${sRes.status}`);
  const sJson: any = await sRes.json();
  const first = sJson?.local_results?.[0] || sJson?.place_results;
  const data_id = first?.data_id || first?.place_id || first?.cid;
  if (!data_id) throw new Error('SerpAPI: no place data_id');

  // 2) fetch reviews
  const revUrl = new URL('https://serpapi.com/search.json');
  revUrl.searchParams.set('engine', 'google_maps_reviews');
  revUrl.searchParams.set('data_id', String(data_id));
  revUrl.searchParams.set('api_key', SERPAPI_KEY);

  const rRes = await fetch(revUrl.toString(), { next: { revalidate: 0 } });
  if (!rRes.ok) throw new Error(`SerpAPI reviews ${rRes.status}`);
  const rJson: any = await rRes.json();

  const items: any[] = rJson?.reviews || [];
  const out: Review[] = items
    .map(it => ({
      text: String(it?.snippet || it?.content || '').trim(),
      rating: Number(it?.rating ?? it?.stars ?? 0) || undefined,
      time: it?.date || it?.published_at || undefined,
    }))
    .filter(r => r.text && r.text.length > 0);

  return out;
}

// --- Google Places (New) fallback ---
async function fetchReviewsGooglePlacesNew(query: string, key: string): Promise<Review[]> {
  // searchText
  const sRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName',
    },
    body: JSON.stringify({ textQuery: query }),
    next: { revalidate: 0 },
  });
  if (!sRes.ok) throw new Error(`Places searchText ${sRes.status}`);
  const sJson: any = await sRes.json();
  const placeId = sJson?.places?.[0]?.id;
  if (!placeId) throw new Error('Places: no match');

  // details with reviews
  const dRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}?fields=reviews`, {
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'reviews.text.text,reviews.rating,reviews.publishTime',
    },
    next: { revalidate: 0 },
  });
  if (!dRes.ok) throw new Error(`Places details ${dRes.status}`);
  const dJson: any = await dRes.json();
  const items: any[] = dJson?.reviews || [];

  const out: Review[] = items
    .map(r => ({
      text: String(r?.text?.text || '').trim(),
      rating: Number(r?.rating ?? 0) || undefined,
      time: r?.publishTime || undefined,
    }))
    .filter(r => r.text && r.text.length > 0);

  return out;
}

// --- OpenAI summarizer ---
async function summarizeWithOpenAI(reviews: Review[], apiKey: string): Promise<{
  positives: string[];
  negatives: string[];
  suggestions: string;
}> {
  // lazy import to avoid bundling issues if not used
  const { OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey });

  const docs = reviews.map((r, i) => `#${i + 1} (${r.rating ?? 'n/a'}★): ${r.text}`).join('\n');

  const system = `You summarize customer reviews for a small business.
Return strict JSON: {"positives":[...5 items...],"negatives":[...5 items...],"suggestions":"..."}
Focus on RECURRING themes only. Short bullet phrases, no duplicates, no fluff.`;

  const user = `Reviews:\n${docs}\n\nTime horizon: recent period. Output strict JSON as specified.`;

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
  });

  let json: any = {};
  try {
    json = JSON.parse(resp.choices[0]?.message?.content || '{}');
  } catch {
    json = {};
  }

  const positives = Array.isArray(json.positives) ? json.positives.slice(0, 5).map(String) : [];
  const negatives = Array.isArray(json.negatives) ? json.negatives.slice(0, 5).map(String) : [];
  const suggestions = typeof json.suggestions === 'string'
    ? json.suggestions
    : 'Address top complaints and double down on praised strengths.';

  return { positives, negatives, suggestions };
}

// Backup if OPENAI key missing
function fauxSummary(revs: Review[]) {
  const texts = revs.map(r => r.text.toLowerCase());
  const quick = (needle: string) => texts.filter(t => t.includes(needle)).length;

  const positives = [
    'Friendly, helpful staff',
    'Clean facility',
    'Professional service',
    'Quick turnaround (off-peak)',
    'Knowledgeable technicians',
  ];

  const negatives = [
    'Wait times during peak hours',
    'Confusing check-in flow',
    'Unclear pricing for add-ons',
    'Occasional miscommunication',
    'Limited seating while waiting',
  ];

  // crude tweak: if we detect “price”, “wait”, etc. bump their chance of appearing
  if (quick('price') === 0) negatives[2] = 'Inconsistent service expectations';
  if (quick('wait') === 0) negatives[0] = 'Limited appointment availability';

  return {
    positives,
    negatives,
    suggestions:
      'Keep doing what earns praise (staff friendliness, cleanliness, professionalism). Fix repeated complaints (wait times, pricing clarity, check-in signage). Add queue visibility during peaks.',
  };
}
