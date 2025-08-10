import { NextResponse } from 'next/server';

const OUTSCRAPER_API_KEY = 'ZDFjMzMxZjBhZDJjNDc2NGFhODQyYjA5NzE5ODc0Njh8ZDU4ZGNkYmE2ZA';
const SERPAPI_KEY = '1545150b18ec0641b59ccc2f1c7114757106fb4149d2ad3da0c3485feeb3cf98';

export async function POST(req: Request) {
  try {
    const { mapUrl, placeId, dateRange } = await req.json();
    if (!mapUrl && !placeId) {
      return NextResponse.json({ error: 'Missing mapUrl or placeId' }, { status: 400 });
    }

    // Try Outscraper first
    const outscraperUrl = `https://api.app.outscraper.com/maps/reviews-v3?query=${encodeURIComponent(
      placeId || mapUrl
    )}&reviewsLimit=100&latest=${dateRange}`;
    let r = await fetch(outscraperUrl, {
      headers: { 'X-API-KEY': OUTSCRAPER_API_KEY },
    });

    if (r.ok) {
      const data = await r.json();
      if (data && data.length > 0 && data[0].reviews) {
        return NextResponse.json({ source: 'outscraper', reviews: data[0].reviews });
      }
    }

    // If Outscraper fails, fallback to SerpAPI
    const serpUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${encodeURIComponent(
      placeId || ''
    )}&api_key=${SERPAPI_KEY}`;
    r = await fetch(serpUrl);
    if (!r.ok) throw new Error(`SerpAPI failed: ${await r.text()}`);

    const serpData = await r.json();
    return NextResponse.json({ source: 'serpapi', reviews: serpData.reviews || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Analyze failed' },
      { status: 500 }
    );
  }
}
