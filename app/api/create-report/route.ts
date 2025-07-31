// app/api/create-report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// --- env & clients ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const openaiKey = process.env.OPENAI_API_KEY || "";
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

// Always dynamic (don’t cache on Vercel)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// --------- Helpers ---------

// VERY SIMPLE review fetcher. If you already have a working fetcher, keep using it.
// Here we just mock a handful using the business URL as context.
async function fetchReviewsMock(businessUrl: string, timeRange: string) {
  // You can replace this with your Google Places call later.
  return [
    { text: "Great service, friendly staff, quick turnaround." },
    { text: "Clean facility and helpful technicians." },
    { text: "Wait time was longer than expected during peak hours." },
    { text: "Price transparency could be better for add-on services." },
    { text: "Professional, polite, and knowledgeable team." },
    { text: "Confusion at check-in; signage could be clearer." },
  ];
}

// AI summarizer (uses OpenAI if key exists)
async function summarizeWithAI(rawReviews: Array<{ text: string }>) {
  const corpus = (rawReviews || [])
    .map((r) => (r?.text || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 200) // keep tokens in check
    .join("\n- ");

  if (!corpus) {
    return {
      positives: [],
      negatives: [],
      suggestions: "No reviews found in the selected range.",
    };
  }

  const prompt = `
You are an operations analyst. Read real Google review snippets and produce structured findings.
Return STRICT JSON with these fields:
- positives: array of 5 concise customer "praise themes" (strings).
- negatives: array of 5 concise customer "complaint themes" (strings).
- suggestions: one short paragraph with the 3 most impactful, concrete fixes.

Rules:
- Be specific and business-actionable.
- No duplicates. If fewer than 5 distinct themes exist, still return 5 by grouping close items.
- No markdown, no commentary—ONLY JSON conforming to the schema.

Reviews:
- ${corpus}
`.trim();

  const resp = await openai!.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: "You write concise business insights in strict JSON only." },
      { role: "user", content: prompt },
    ],
  });

  const text = resp.choices?.[0]?.message?.content?.trim() || "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }

  const positives = Array.isArray(parsed?.positives)
    ? parsed.positives.map(String).slice(0, 5)
    : [];
  const negatives = Array.isArray(parsed?.negatives)
    ? parsed.negatives.map(String).slice(0, 5)
    : [];
  const suggestions =
    (parsed?.suggestions ? String(parsed.suggestions) : "").trim() ||
    "Based on reviews, focus on staffing during peaks, response times, and clarity on pricing/services.";

  return { positives, negatives, suggestions };
}

// Fallback summarizer if no OPENAI_API_KEY (keeps app usable)
function summarizeMock(rawReviews: Array<{ text: string }>) {
  const positives = [
    "Friendly, helpful staff",
    "Clean facility",
    "Professional service",
    "Quick turnaround when not at peak times",
    "Knowledgeable technicians",
  ];
  const negatives = [
    "Wait times during peak hours",
    "Confusing check-in flow",
    "Unclear pricing for add-ons",
    "Occasional miscommunication at front desk",
    "Limited seating while waiting",
  ];
  const suggestions =
    "Keep doing what earns praise (staff friendliness, cleanliness, professionalism). Fix repeated complaints (wait times, pricing clarity, check‑in signage). Add queue visibility during peaks.";

  return { positives, negatives, suggestions };
}

// --------- POST handler ---------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const business_url = String(body?.business_url || "").trim();
    const business_name = (body?.business_name ? String(body.business_name) : "") || null;
    const time_range = String(body?.time_range || "90").trim(); // days or “all”

    if (!business_url) {
      return NextResponse.json(
        { error: "Missing business_url" },
        { status: 400 }
      );
    }

    // 1) create placeholder row (status=processing)
    const initial = {
      business_url,
      business_name,
      time_range,
      status: "processing",
      error: null as string | null,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("reports")
      .insert(initial)
      .select("*")
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: `Insert failed: ${insertErr.message}` },
        { status: 500 }
      );
    }

    const reportId = inserted.id;

    // 2) fetch raw reviews
    const raw_reviews = await fetchReviewsMock(business_url, time_range);

    // 3) summarize (AI if key is present, otherwise mock)
    let positives: string[] = [];
    let negatives: string[] = [];
    let suggestions = "";

    if (openai) {
      ({ positives, negatives, suggestions } = await summarizeWithAI(raw_reviews));
    } else {
      ({ positives, negatives, suggestions } = summarizeMock(raw_reviews));
    }

    // 4) update row with results
    const updatePayload: any = {
      positives,
      negatives,
      suggestions,
      status: "completed",
      error: null,
    };

    // If you created a raw_reviews jsonb column (optional), save it too
    if ("raw_reviews" in (inserted || {})) {
      updatePayload.raw_reviews = raw_reviews;
    }
    if ("report_name" in (inserted || {}) && !inserted.report_name && business_name) {
      // If you kept a legacy 'report_name' column, fill it with business_name
      updatePayload.report_name = business_name;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("reports")
      .update(updatePayload)
      .eq("id", reportId)
      .select("*")
      .single();

    if (updateErr) {
      // Mark as error, return message
      await supabase.from("reports").update({ status: "error", error: updateErr.message }).eq("id", reportId);
      return NextResponse.json(
        { error: `Update failed: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // 5) return the final saved report
    const res = NextResponse.json(updated, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
