// app/api/dashboard-data/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Make this route always dynamic + uncached on Vercel/Next
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type RawRow = {
  id?: string;
  created_at?: string | null;
  business_name?: string | null;
  business_url?: string | null;
  time_range?: string | null;
  positives?: string[] | null;
  negatives?: string[] | null;
  suggestions?: string | null;
  status?: string | null;
  error?: string | null;
  // legacy fields
  report_name?: string | null;
  top_positive?: string | null;
  top_complaint?: string | null;
};

type Report = {
  id: string;
  created_at: string | null;
  business_name: string | null;
  business_url: string | null;
  time_range: string | null;
  positives: string[];
  negatives: string[];
  suggestions: string | null;
  status: string | null;
  error: string | null;
};

function normalizeRows(rows: RawRow[]): Report[] {
  return (rows || [])
    .map((r, idx) => {
      const id = String(r.id ?? `${r.created_at ?? "no-date"}-${idx}`);

      const business_name =
        (r.business_name ?? r.report_name ?? "") || null;

      const positives =
        Array.isArray(r?.positives) && r.positives.length > 0
          ? r.positives.map(String)
          : r?.top_positive
          ? [String(r.top_positive)]
          : [];

      const negatives =
        Array.isArray(r?.negatives) && r.negatives.length > 0
          ? r.negatives.map(String)
          : r?.top_complaint
          ? [String(r.top_complaint)]
          : [];

      const suggestions =
        r?.suggestions != null ? String(r.suggestions) : null;

      return {
        id,
        created_at: r.created_at ?? null,
        business_name,
        business_url: r.business_url ?? null,
        time_range: r.time_range ?? null,
        positives,
        negatives,
        suggestions,
        status: r.status ?? null,
        error: r.error ?? null,
      } as Report;
    })
    // drop pure placeholders
    .filter((r) => {
      const hasContent =
        (r.positives && r.positives.length > 0) ||
        (r.negatives && r.negatives.length > 0) ||
        (r.suggestions && r.suggestions.trim().length > 0);
      return Boolean(r.business_name) || hasContent;
    })
    // newest first
    .sort((a, b) => {
      const da = a.created_at ? Date.parse(a.created_at) : 0;
      const db = b.created_at ? Date.parse(b.created_at) : 0;
      return db - da;
    });
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select(
        "id, created_at, business_name, business_url, time_range, positives, negatives, suggestions, status, error, report_name, top_positive, top_complaint"
      )
      .order("created_at", { ascending: false });

    if (error) {
      const resp = NextResponse.json(
        { reports: [], data: [], error: error.message },
        { status: 500 }
      );
      resp.headers.set("Cache-Control", "no-store");
      return resp;
    }

    const reports = normalizeRows(data || []);

    // Return BOTH shapes so any old/new client code works:
    // - `reports: [...]` (new)
    // - `data: { reports: [...] }` (old)
    const resp = NextResponse.json(
      { reports, data: { reports }, error: null },
      { status: 200 }
    );
    resp.headers.set("Cache-Control", "no-store");
    return resp;
  } catch (e: any) {
    const resp = NextResponse.json(
      { reports: [], data: [], error: String(e?.message || e) },
      { status: 500 }
    );
    resp.headers.set("Cache-Control", "no-store");
    return resp;
  }
}
