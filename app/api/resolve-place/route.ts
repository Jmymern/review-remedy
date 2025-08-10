import { NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBO8NzvtnthW4TbLTvb0amVq0QZRDQLq8w';

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
  return trimmed;
}

export async function POST(req: Request) {
  try {
    const { userInput } = await req.json();
    if (!userInput) {
      return NextResponse.json({ error: 'Missing input' }, { status: 400 });
    }

    const normalizedUrl = normalizePotentialGMapsUrl(userInput);
    const directPlaceId = extractPlaceIdFromUrl(normalizedUrl || '');
    if (directPlaceId) {
      return NextResponse.json({
        normalizedUrl,
        placeId: directPlaceId,
        name: undefined,
      });
    }

    const url =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(normalizedUrl)}` +
      `&inputtype=textquery&fields=place_id,name&key=${GOOGLE_MAPS_API_KEY}`;

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
