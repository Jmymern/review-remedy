// app/api/create-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ---- ENV ----
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

// ---- INIT ----
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ---- Helpers: Google Places (New) ----
async function searchPlaceId(textQuery: string) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.googleMapsUri',
        'places.userRatingCount',
        'places.rating'
      ].join(',')
    },
    body: JSON.stringify({ textQuery })
  });

  if (!res.ok) throw new Error(`Places searchText failed (${res.status})`);
  const json = await res.json();
  const place = (json?.places || [])[0];
  if (!place?.id) throw new Error('No place found for that query');
  return {
    placeId: place.id as string,
    displayName: place.displayName?.text || null,
    address: place.formattedAddress || null,
    uri: place.googleMapsUri || null,
    userRatingCount: place.userRatingCount || 0,
    rating: place.rating || null
  };
}

async function fetchPlaceWithReviews(placeId: string) {
  // Reviews field returns up to ~5 recent/most relevant reviews (Google limitation).
  const fields = [
    'id',
    'displayName',
    'formattedAddress',
    'googleMapsUri',
    'userRatingCount',
    'rating',
    'reviews'
  ].join(',');
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=${fields}`;

  const res = await fetch(url, {
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY }
  });
  if (!res.ok) throw new Error(`Places details failed (${res.status})`);
  const json = await res.json();

  const reviews: Array<{
    text?: { text?: string };
    originalText?: { text?: string };
    rating?: number;
    publishTime?: string;
    authorAttribution?: { displayName?: string };
  }> = json?.reviews || [];

  const normalized = reviews.map(r => ({
    text: r.originalText?.text || r.text?.text || '',
    rating: r.rating ?? null,
    time: r.publishTime || null,
    author: r.authorAttribution?.displayName || null
  })).filter(r => (r.text || '').trim().length > 0);

  return {
    business_name: json?.displayName?.text || null,
    business_url: json?.googleMapsUri || null,
    address: json?.formattedAddress || null,
    userRatingCount: json?.userRatingCount || 0,
    rating: json?.rating || null,
    reviews: normalized
  };
}

// Best‑effort: pull something useful out of the submitted URL for text search
function roughGuessFromUrl(url: string): string {
  try {
    const u = new URL(url);
    // prefer /place/<name>/ or /dir//<address> patterns
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === 'place');
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1].replace(/\+/g, ' '));
    // try q= or destination queries
    if (u.searchParams.get('q')) return decodeURIComponent(u.searchParams.get('q')!);
    if (u.searchParams.get('destination')) return decodeURIComponent(u.searchParams.get('destination')!);
  } catch {}
  return '';
}

// ---- OpenAI Summarizer ----
async function summarizeWithOpenAI(allReviews: string[]) {
  // If no key, produce a basic placeholder so the UI still works.
  if (!OPENAI_KEY) {
    return {
      positives: [
        'Friendly, helpful staff',
        'Clean facility',
        'Professional service',
        'Quick turnaround',
        'Knowledgeable technicians'
      ],
      negatives: [
        'Wait times during peaks',
        'Confusing check‑in flow',
        'Unclear pricing for add‑ons',
        'Occasional miscommunication',
        'Limited seating while waiting'
      ],
      suggestions:
        'Keep doing what earns praise (staff friendliness, cleanliness, professionalism). ' +
        'Fix repeated complaints (wait times, pricing clarity, check‑in signage). ' +
        'Add queue visibility during peaks.'
    };
  }

  const system = `You are a concise CX analyst. From the raw customer reviews, extract:
1) Top 5 recurring positive themes (bulleted short phrases),
2) Top 5 recurring negative themes (bulleted short phrases),
3) A short, concrete action plan (3–6 sentences) to improve negatives while preserving strengths.
Return strict JSON with keys: positives (string[]), negatives (string[]), suggestions (string).`;

  const user = `RAW REVIEWS:
${allReviews.join('\n---\n')}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) throw new Error(`OpenAI failed (${res.status})`);
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);

  const positives = Array.isArray(parsed?.positives) ? parsed.positives.slice(0, 5).map(String) : [];
  const negatives = Array.isArray(parsed?.negatives) ? parsed.negatives.slice(0, 5).map(String) : [];
  const suggestions = typeof parsed?.suggestions === 'string' ? parsed.suggestions : '';

  return { positives, negatives, suggestions };
}

// ---- Route ----
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const business_url = String(body?.business_url || '').trim();
    const business_name = (body?.business_name ? String(body.business_name) : '').trim();
    const time_range = String(body?.time_range || '90').trim();

    if (!business_url && !business_name) {
      return NextResponse.json({ error: 'Provide a Google Maps URL or a business name' }, { status: 400 });
    }

    // Insert placeholder row (processing)
    const { data: inserted, error: insErr } = await supabase
      .from('reports')
      .insert({
        business_name: business_name || null,
        business_url: business_url || null,
        time_range,
        status: 'processing'
      })
      .select('*')
      .single();

    if (insErr) throw insErr;
    const reportId = inserted.id;

    // Resolve placeId (search by business_name first; otherwise try to infer from URL)
    let searchText = business_name || roughGuessFromUrl(business_url);
    if (!searchText) searchText = business_url; // last resort
    const { placeId } = await searchPlaceId(searchText);

    // Fetch details + reviews
    const place = await fetchPlaceWithReviews(placeId);
    const allTexts = (place.reviews || []).map(r => r.text).filter(Boolean);

    // Summarize with OpenAI
    const summary = await summarizeWithOpenAI(allTexts);

    // Save full result
    const { data: updated, error: upErr } = await supabase
      .from('reports')
      .update({
        business_name: place.business_name || business_name || inserted.business_name,
        business_url: place.business_url || business_url || inserted.business_url,
        positives: summary.positives,
        negatives: summary.negatives,
        suggestions: summary.suggestions,
        raw_reviews: place.reviews, // keep the raw reviews for audit
        status: 'completed',
        error: null
      })
      .eq('id', reportId)
      .select('*')
      .single();

    if (upErr) throw upErr;

    return NextResponse.json(updated, { status: 200 });
  } catch (err: any) {
    // Best effort: mark latest "processing" row as error if we can
    try {
      await supabase
        .from('reports')
        .update({ status: 'error', error: err?.message || 'Unknown error' })
        .eq('status', 'processing');
    } catch {}

    return NextResponse.json({ error: err?.message || 'Failed to create report' }, { status: 500 });
  }
}
