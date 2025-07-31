// app/api/create-report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";       // ensure Node runtime
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---- Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- OpenAI (no SDK)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Mock review fetcher (replace with your Google fetch later)
async function fetchReviewsMock(businessUrl: string, timeRange: string) {
  return [
    { text: "Great service, friendly staff, quick turnaround." },
    { text: "Clean facility and helpful technicians." },
    { text: "Wait time was longer than expected during peak hours." },
    { text: "Price transparency could be better for add-on services." },
    { text: "Professional, polite, and knowledgeable team." },
    { text: "Confusion at check-in; signage could be clearer." },
  ];
}

async function summarizeWithOpenAI(rawReviews: Array<{ text: string }>) {
  if (!OPENAI_API_KEY) {
    return {
      positives: [],
      negatives: [],
      suggestions:
        "OPENAI_API_KEY not set in production. Add it in Vercel → Settings → Environment Variables.",
    };
  }

  const corpus = (rawReviews || [])
    .map((r) => (r?.text || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 200)
    .join("\n- ");

  if (!corpus) {
    return { positives: [], negatives: [], suggestions: "No reviews found in the selected range." };
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

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You write concise business insights in strict JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!resp.ok) {
    const errTxt = await resp.text().catch(() => "");
    throw new Error(`OpenAI error ${resp.status}: ${errTxt}`);
  }

  const json = await resp.json();
  const text = json?.choices?.[0]?.message?.content?.trim() || "{}";

  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch {}

  const positives = Array.isArray(parsed?.positives) ? parsed.positives.map(String).slice(0, 5) : [];
  const negatives = Array.isArray(parsed?.negatives) ? parsed.negatives.map(String).slice(0, 5) : [];
  const suggestions = (parsed?.suggestions ? String(parsed.suggestions) : "").trim()
    || "Based on reviews, focus on staffing during peaks, response times, and clarity on pricing/services.";

  return { positives, negatives, suggestions };
}

function summarizeMock(_: Array<{ text: string }>) {
  return {
    positives: [
      "Friendly, helpful staff",
      "Clean facility",
      "Professional service",
      "Quick turnaround (off-peak)",
      "Knowledgeable technicians",
    ],
    negatives: [
      "Wait times during peak hours",
      "Confusing check-in flow",
      "Unclear pricing for add-ons",
      "Occasional miscommunication",
      "Limited seating while waiting",
    ],
    suggestions:
      "Keep doing what earns praise (staff friendliness, cleanliness, professionalism). Fix repeated complaints (wait times, pricing clarity, check‑in signage). Add queue visibility during peaks.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const business_url = String(body?.business_url || "").trim();
    const business_name = (body?.business_name ? String(body.business_name) : "") || null;
    const time_range = String(body?.time_range || "90").trim();

    if (!business_url) {
      return NextResponse.json({ error: "Missing business_url" }, { status: 400 });
    }

    // 1) insert placeholder row
    const { data: inserted, error: insertErr } = await supabase
      .from("reports")
      .insert({
        business_url,
        business_name,
        time_range,
        status: "processing",
        error: null,
      })
      .select("*")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: `Insert failed: ${insertErr.message}` }, { status: 500 });
    }

    const id = inserted.id;

    // 2) fetch reviews
    const raw_reviews = await fetchReviewsMock(business_url, time_range);

    // 3) summarize (OpenAI if key present; else mock)
    let positives: string[] = [];
    let negatives: string[] = [];
    let suggestions = "";

    try {
      if (OPENAI_API_KEY) {
        ({ positives, negatives, suggestions } = await summarizeWithOpenAI(raw_reviews));
      } else {
        ({ positives, negatives, suggestions } = summarizeMock(raw_reviews));
      }
    } catch (e: any) {
      // Log and fall back to mock
      ({ positives, negatives, suggestions } = summarizeMock(raw_reviews));
      await supabase.from("reports").update({
        status: "error",
        error: `AI summarize failed: ${String(e?.message || e)}`,
      }).eq("id", id);
    }

    // 4) update row with results
    const updatePayload: any = {
      positives,
      negatives,
      suggestions,
      status: "completed",
      error: null,
    };
    if ("raw_reviews" in (inserted || {})) updatePayload.raw_reviews = raw_reviews;
    if ("report_name" in (inserted || {}) && !inserted.report_name && business_name) {
      updatePayload.report_name = business_name;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("reports")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr) {
      await supabase.from("reports").update({ status: "error", error: updateErr.message }).eq("id", id);
      return NextResponse.json({ error: `Update failed: ${updateErr.message}` }, { status: 500 });
    }

    const res = NextResponse.json(updated, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
