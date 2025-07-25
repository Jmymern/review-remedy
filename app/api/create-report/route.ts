import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tyqpgfjbjrcqmrisxvln.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cXBnZmpianJjcW1yaXN4dmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjU3NTMsImV4cCI6MjA2Nzk0MTc1M30.izgyrjqeooALMd705IW28WLkDN_pyMbpuOTFr1zuAbk";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🔥 FAKE AI function for now (mocked logic)
function generateSummary(reviewText: string) {
  const topComplaint = reviewText.includes("crowded")
    ? "Too crowded during peak hours"
    : "Not enough staff";

  const topPositive = reviewText.includes("love")
    ? "Friendly and helpful staff"
    : "Good customer service";

  const suggestion = topComplaint.includes("crowded")
    ? "Add more workout equipment and extend evening hours"
    : "Hire more staff for busy times";

  return { topComplaint, topPositive, suggestion };
}

export async function POST(req: NextRequest) {
  try {
    const { review_set } = await req.json();

    if (!review_set || !Array.isArray(review_set)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing review_set" }),
        { status: 400 }
      );
    }

    const summaries = review_set.map((review: any) => {
      const { topComplaint, topPositive, suggestion } = generateSummary(
        review.review_text
      );

      return {
        report_name: `${review.business_name} Summary`,
        top_complaint: topComplaint,
        top_positive: topPositive,
        suggestions: suggestion,
        created_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase.from("reviews").insert(summaries);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ message: "Summary created" }), {
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
