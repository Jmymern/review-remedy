// app/api/reports/[id]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use the same envs you already have configured on Vercel
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * DELETE /api/reports/:id
 * Deletes a report row by id.
 * Next.js requires the second argument to be { params: { id: string } }.
 */
export async function DELETE(
  _req: Request,
  context: { params: { id: string } }
) {
  try {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
    }

    const { error } = await supabase.from('reports').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Delete failed' },
      { status: 500 }
    );
  }
}
