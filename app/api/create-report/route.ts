// File: app/api/create-report/route.ts
import { NextResponse } from 'next/server';

const OUTSCRAPER_API_KEY =
  process.env.OUTSCRAPER_API_KEY || process.env.NEXT_PUBLIC_OUTSCRAPER_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// NOTE: Adjust endpoint/params to match your Outscraper account plan & docs.
async function fetchReviews(placeUrl: string, days: number) {
  if (!OUTSCRAPER_API_KEY) {
    throw new Error('Outscraper API key missing on server.');
  }

  // Example endpoint (you may need to adapt to your exact Outscraper method/params)
  const url = `https://api.app.outscraper.com/places/reviews?query=${encodeURIComponent(
    placeUrl
  )}&reviewsPeriod=${days}`;

  const r = await fetch(url, {
    headers: {
      'X-API-KEY': OUTSCRAPER_API_KEY,
      Accept: 'application/json',
    },
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Outscraper error (${r.status}): ${t}`);
  }

  // Normalize: expect an array of review objects that include 'text'/'content'
  const data = await r.json();

  // Try to collect texts defensively
  const texts: string[] = [];
  const pushIf = (s: any) => {
    if (typeof s === 'string' && s.trim().length > 0) texts.push(s.trim());
  };

  if (Array.isArray(data)) {
    for (const item of data) {
      if (Array.isArray(item?.reviews)) {
        for (const rv of item.reviews) {
          pushIf(rv?.text || rv?.content || rv?.review_text);
        }
      }
      // some responses may just be raw reviews array
      pushIf(item?.text || item?.content || item?.review_text);
    }
  } else if (data?.reviews && Array.isArray(data.reviews)) {
    for (const rv of data.reviews) pushIf(rv?.text || rv?.content || rv?.review_text);
  }

  return texts.slice(0, 200); // cap to keep prompt small
}

async function analyzeWithAI(reviews: string[]) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key missing on server.');
  }

  const prompt = `
You are analyzing customer reviews. Given the raw reviews below, identify:
- Top 5 recurring positive themes (bullet points).
- Top 5 recurring negative themes (bullet points).
- A concise action plan: 5–8 steps. Be specific, tactical, and non-generic.

Return JSON with keys:
{
  "positives": string[],
  "negatives": string[],
  "suggestions": string[],
  "summary": string
}

REVIEWS:
${reviews.map((r, i) => `- ${r}`).join('\n')}
`.trim();

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You analyze customer reviews and return structured JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI error (${r.status}): ${t}`);
  }
  const data = await r.json();

  // Try to parse JSON out of the assistant message
  const content: string = data.choices?.[0]?.message?.content || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Fallback: try to extract JSON block
    const match = content.match(/\{[\s\S]*\}$/);
    if (match) parsed = JSON.parse(match[0]);
  }
  if (!parsed) {
    throw new Error('AI did not return valid JSON.');
  }

  const positives = Array.isArray(parsed.positives) ? parsed.positives.slice(0, 5) : [];
  const negatives = Array.isArray(parsed.negatives) ? parsed.negatives.slice(0, 5) : [];
  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const summary = typeof parsed.summary === 'string'
    ? parsed.summary.slice(0, 1500)
    : 'Summary unavailable';

  return { positives, negatives, suggestions, summary };
}

export async function POST(req: Request) {
  try {
    const { placeUrl, days } = await req.json();
    if (!placeUrl || !days) {
      return NextResponse.json({ error: 'placeUrl and days are required.' }, { status: 400 });
    }

    const reviews = await fetchReviews(String(placeUrl), Number(days));
    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ error: 'No reviews found for the given input.' }, { status: 404 });
    }

    const analysis = await analyzeWithAI(reviews);
    return NextResponse.json(analysis);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
