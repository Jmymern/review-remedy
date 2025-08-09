import { NextResponse } from 'next/server';

function extractFromIframe(html: string): string | null {
  const m = html.match(/<iframe[^>]+src="([^"]+)"/i);
  return m?.[1] || null;
}

function extractPlaceIdFromUrl(url: string): string | null {
  const m = url.match(/[?&]placeid=([^&]+)/i) || url.match(/place_id=([^&]+)/i);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

function normalizePotentialGMapsUrl(raw: string): string {
  const trimmed = raw.trim();
  const iframeSrc = /<iframe/i.test(trimmed) ? extractFromIframe(trimmed) : null;
  if (iframeSrc) return iframeSrc;

  // If it's a short link or anything else, just return as-is (we’ll resolve via Places API)
  return trimmed;
}

export async function POST(req: Request) {
  try {
    const { userInput } = await req.json();

    if (!userInput) {
      return NextResponse.json({ error: 'Missing input' }, { status: 400 });
    }

    const normalizedUrl = normalizePotentialGMapsUrl(userInput);

    // If the URL already contains a place_id, use it
    const directPlaceId = extractPlaceIdFromUrl(normalizedUrl || '');
    if (directPlaceId) {
      return NextResponse.json({
        normalizedUrl,
        placeId: directPlaceId,
        name: undefined,
      });
    }

    // Otherwise call Places API "Find Place From Text" (textquery)
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: 'Missing GOOGLE_MAPS_API_KEY' },
        { status: 500 }
      );
    }

    // We’ll try to grab business name if the link has it in path, but default to full URL
    const inputText = normalizedUrl;

    const url =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(inputText)}` +
      `&inputtype=textquery&fields=place_id,name&key=${key}`;

    const r = await fetch(url, { cache: 'no-store' });
    const data = await r.json();

    if (!data?.candidates?.length) {
      return NextResponse.json({
        normalizedUrl,
        error: 'Could not resolve a place_id from the link/text.',
      });
    }

    const { place_id: placeId, name } = data.candidates[0];
    return NextResponse.json({ normalizedUrl, placeId, name });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Resolve failed' },
      { status: 500 }
    );
  }
}
