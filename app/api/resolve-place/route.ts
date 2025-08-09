import { NextResponse } from 'next/server';

function extractIframeSrc(html: string): string | null {
  const m = html.match(/<iframe[^>]+src="([^"]+)"/i);
  return m?.[1] || null;
}

function tryGetPlaceIdFromUrl(u: URL): string | null {
  // Most common first
  const qp = u.searchParams.get('query_place_id');
  if (qp) return qp;
  const pid = u.searchParams.get('place_id') || u.searchParams.get('placeid');
  if (pid) return pid;
  return null;
}

function tryGuessNameFromPath(u: URL): string | null {
  // /maps/place/<NAME>/...
  const segs = u.pathname.split('/').filter(Boolean);
  const i = segs.findIndex((s) => s.toLowerCase() === 'place');
  if (i >= 0 && segs[i + 1]) {
    // names are often URL-encoded with + for spaces
    return decodeURIComponent(segs[i + 1]).replace(/\+/g, ' ');
  }
  return null;
}

async function expandShortlinkIfNeeded(raw: string): Promise<string> {
  try {
    const u = new URL(raw);
    if (u.hostname === 'maps.app.goo.gl') {
      // follow redirect to the long google.com/maps URL
      const r = await fetch(raw, { redirect: 'follow' });
      // In edge runtimes, fetch returns the final body but not final URL; we’ll try Response.url
      // If not present, just return original (Places textquery will still work)
      return (r as any).url || raw;
    }
    return raw;
  } catch {
    return raw;
  }
}

export async function POST(req: Request) {
  try {
    const { userInput } = await req.json();
    if (!userInput) {
      return NextResponse.json({ error: 'Missing input' }, { status: 400 });
    }

    // 1) normalize (iframe -> src URL)
    let normalized = userInput.trim();
    const iframeSrc = /<iframe/i.test(normalized) ? extractIframeSrc(normalized) : null;
    if (iframeSrc) normalized = iframeSrc;

    // 2) try to parse as URL, and get place_id directly
    let placeId: string | null = null;
    let nameGuess: string | null = null;

    try {
      // expand shortlinks first
      normalized = await expandShortlinkIfNeeded(normalized);
      const u = new URL(normalized);
      placeId = tryGetPlaceIdFromUrl(u);
      nameGuess = tryGuessNameFromPath(u);
    } catch {
      // not a URL (probably just a business name)
    }

    if (placeId) {
      return NextResponse.json({ normalizedUrl: normalized, placeId, name: nameGuess || undefined });
    }

    // 3) Resolve via Places Find Place From Text
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ error: 'Missing GOOGLE_MAPS_API_KEY' }, { status: 500 });
    }

    const inputText = nameGuess || normalized; // prefer readable name if we have it
    const url =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(inputText)}` +
      `&inputtype=textquery&fields=place_id,name,formatted_address` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const r = await fetch(url, { cache: 'no-store' });
    const data = await r.json();

    if (!data?.candidates?.length) {
      return NextResponse.json({
        normalizedUrl: normalized,
        error: 'Could not resolve a place_id from the link/text.',
      });
    }

    placeId = data.candidates[0].place_id;
    const resolvedName = data.candidates[0].name;

    return NextResponse.json({
      normalizedUrl: normalized,
      placeId,
      name: resolvedName || nameGuess || undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Resolve failed' },
      { status: 500 }
    );
  }
}
