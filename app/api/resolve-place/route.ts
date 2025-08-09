// File: app/api/resolve-place/route.ts
import { NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

function extractIframeSrc(input: string): string | null {
  const m = input.match(/<iframe[^>]*src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

function normalizeQueryFromUrlLike(s: string): string | null {
  try { s = decodeURIComponent(s); } catch {}
  const placeIdQ = /[?&]q=place_id:([A-Za-z0-9_-]+)/.exec(s);
  if (placeIdQ?.[1]) return `place_id:${placeIdQ[1]}`;
  const placeIdParam = /[?&]place_id=([A-Za-z0-9_-]+)/.exec(s);
  if (placeIdParam?.[1]) return `place_id:${placeIdParam[1]}`;
  const cid = /[?&]cid=([0-9]+)/.exec(s);
  if (cid?.[1]) return `cid:${cid[1]}`;
  const sixteenS = /!16s([^!]+)/.exec(s);
  if (sixteenS?.[1]) {
    try {
      const decoded = decodeURIComponent(sixteenS[1]).replace(/^%2F/,'/');
      if (decoded.startsWith('/g/')) return `place_id:${decoded.slice(1)}`;
    } catch {}
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { input } = await req.json();
    if (!input) return NextResponse.json({ error: 'input is required' }, { status: 400 });

    let raw = String(input).trim();
    const src = extractIframeSrc(raw);
    if (src) raw = src;

    // If URL, attempt to parse place_id/cid
    if (/^https?:\/\//i.test(raw)) {
      const normalized = normalizeQueryFromUrlLike(raw);
      if (normalized) return NextResponse.json({ query: normalized });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      // Can't resolve via Places API without key; return raw as best effort
      return NextResponse.json({ query: raw });
    }

    // Resolve via Google Places: Find Place From Text
    const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
    url.searchParams.set('input', raw);
    url.searchParams.set('inputtype', 'textquery');
    url.searchParams.set('fields', 'place_id');
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

    const r = await fetch(url.toString());
    if (!r.ok) return NextResponse.json({ query: raw });
    const j = await r.json();
    const pid = j?.candidates?.[0]?.place_id as string | undefined;

    return NextResponse.json({ query: pid ? `place_id:${pid}` : raw });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'resolve error' }, { status: 500 });
  }
}
