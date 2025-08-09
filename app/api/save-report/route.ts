import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { summary, positives, negatives, actions, placeUrl, timeframe } = await req.json();

    // get current user from client session (JWT in auth cookie)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data, error } = await supabase
      .from('reports')
      .insert({
        user_id: user.id,
        summary,
        positives,
        negatives,
        actions,
        place_url: placeUrl ?? null,
        timeframe: timeframe ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, report: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
