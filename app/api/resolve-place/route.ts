// app/api/resolve-place/route.ts

export type ResolveResp = {
  normalizedUrl?: string;
  placeId?: string;
  name?: string;
  error?: string;
};

export const dynamic = 'force-dynamic';

// This route isn't used at runtime; we keep it so TS treats this file as a module
export async function GET() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
}
