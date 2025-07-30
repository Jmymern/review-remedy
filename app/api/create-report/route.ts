// app/api/create-report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// --- Supabase client from .env.local ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Keys from .env.local ---
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ---------- Helpers ----------
function isValidGmapsInput(s?: string) {
  return !!s && s.length > 3;
}

// Find place_id from whatever the user pasted (URL or text)
async function findPlaceIdFromText(textQuery: string): Promise<string | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
  url.searchParams.set("input", textQuery);
  url.searchParams.set("inputtype", "textquery");
  url.searchParams.set("fields", "place_id");
  url.searchParams.set("key", GOOGLE_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`findplacefromtext failed: ${res.status}`);
  const data = await res.json();

  const candidates = data?.candidates || [];
  const placeId = candidates[0]?.place_id || null;
  return placeId;
}

type Review = { text: string; time?: number };

async function fetchPlaceReviews(placeId: string): Promise<Review[]> {
  // Google Places Details returns up to ~5 reviews
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "reviews");
  url.searchParams.set("key", GOOGLE_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`place/details failed: ${res.status}`);
  const data = await res.json();

  const reviews = (data?.result?.reviews || []).map((r: any) => ({
    text: (r?.text || r?.content || "").toString(),
    time: r?.time,
  })) as Review[];

  return reviews.filter(r => r.text && r.text.trim().length > 0);
}

// ---------- Simple fallback summarizer ----------
function simpleSummarize(reviews: Review[]) {
  const positives: string[] = [];
  const negatives: string[] = [];
  const posWords = ["great","excellent","friendly","clean","love","fast","amazing","helpful"];
  const negWords = ["slow","bad","rude","dirty","expensive","wait","cold","overpriced"];

  for (const r of reviews) {
    const low = r.text.toLowerCase();
    const pos = posWords.some(w => low.includes(w));
    const neg = negWords.some(w => low.includes(w));
    if (pos && !neg) positives.push(r.text);
    else if (neg && !pos) negatives.push(r.text);
  }

  return {
    positives: positives.slice(0, 5),
    negatives: negatives.slice(0, 5),
    suggestions:
`• Keep doing what earns praise (staff friendliness, cleanliness, speed).
• Fix repeated complaints (wait times, pricing clarity, customer service).
• AI themes & prioritized fixes appear when OPENAI_API_KEY is set.`,
  };
}

// ---------- OpenAI summarizer ----------
async function aiSummarize(reviews: Review[], businessName?: string | null) {
  if (!OPENAI_API_KEY) return simpleSummarize(reviews);
  if (reviews.length === 0) {
    return { positives: [], negatives: [], suggestions: "No reviews found in Google Places for this listing." };
  }

  const chunks = reviews.map(r => r.text).slice(0, 100); // safety cap
  const prompt = `
You analyze Google review excerpts and output a concise, actionable summary as JSON:

{
  "positives": ["short theme", ... up to 5],
  "negatives": ["short theme", ... up to 5],
  "suggestions": "5-7 prioritized fixes in plain English (bullet-style lines)."
}

Business: ${businessName || "Unknown"}
Reviews:
${chunks.map((t,i)=>`${i+1}. ${t.replace(/\n/g," ")}`).join("\n")}

Rules:
- Keep each theme short (<= 8 words) and not duplicated.
- Focus on repeated praise and complaints.
- suggestions: a single string with short, imperative lines.
- Return JSON only, no extra text.
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You turn raw reviews into clear, actionable business insights." },
        { role: "user", content: prompt }
      ],
    }),
  });

  if (!res.ok) {
    // fallback if OpenAI fails
    return simpleSummarize(reviews);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "{}";

  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch { return simpleSummarize(reviews); }

  const positives = Array.isArray(parsed?.positives) ? parsed.positives.slice(0,5) : [];
  const negatives = Array.isArray(parsed?.negatives) ? parsed.negatives.slice(0,5) : [];
  const suggestions = typeof parsed?.suggestions === "string"
    ? parsed.suggestions
    : "Maintain praised experiences and address repeated complaints first.";

  return { positives, negatives, suggestions };
}

// ---------- Handler ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const business_url: string = (body?.business_url || "").trim();
    const business_name: string | null = (body?.business_name || "").trim() || null;
    const time_range: string = (body?.time_range || "90").toString();

    if (!isValidGmapsInput(business_url)) {
      return NextResponse.json({ error: "Missing or invalid business_url." }, { status: 400 });
    }

    // Insert an initial row with processing (so UI can show state)
    const { data: inserted, error: insertErr } = await supabase
      .from("reports")
      .insert({ business_url, business_name, time_range, status: "processing" })
      .select()
      .single();

    if (insertErr || !inserted) throw new Error(insertErr?.message || "Insert failed");

    try {
      // Resolve place_id
      const queryText = business_name ? `${business_name} ${business_url}` : business_url;
      const placeId = await findPlaceIdFromText(queryText);
      if (!placeId) throw new Error("Could not resolve place_id from the input.");

      // Fetch reviews (Google returns up to ~5 here)
      const reviews = await fetchPlaceReviews(placeId);

      // Summarize with OpenAI (fallback to simple)
      const summary = await aiSummarize(reviews, business_name);

      // Update as completed
      const { data: updated, error: updErr } = await supabase
        .from("reports")
        .update({
          raw_reviews: reviews,
          positives: summary.positives,
          negatives: summary.negatives,
          suggestions: summary.suggestions,
          status: "completed",
          error: null,
        })
        .eq("id", inserted.id)
        .select()
        .single();

      if (updErr || !updated) throw new Error(updErr?.message || "Update failed");

      return NextResponse.json({ report: updated }, { status: 200 });
    } catch (inner: any) {
      await supabase
        .from("reports")
        .update({ status: "error", error: String(inner?.message || inner) })
        .eq("id", inserted.id);
      return NextResponse.json({ error: String(inner?.message || inner) }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}
