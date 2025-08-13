'use client';

import { useState } from 'react';

type ApiResult = {
  ok?: boolean;
  placeId?: string | null;
  placeName?: string;
  days?: number;
  reviewCount?: number;
  reviews?: string[];
  aiAnalysis?: string; // raw text from API
  analysis?: any;      // if backend ever returns structured JSON in future
  source?: string;
  error?: string;
};

type ParsedAnalysis = {
  positives: string[];
  negatives: string[];
  improve: string[];
  keep: string[];
  raw: string;
};

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(' ');
}

/** Try to parse AI output into buckets. Works with JSON or free text. */
function parseAiAnalysis(aiAnalysis?: string, analysisObj?: any): ParsedAnalysis {
  // 1) If backend ever returns structured JSON
  if (analysisObj && typeof analysisObj === 'object') {
    const p = (analysisObj.positives || analysisObj.strengths || []) as string[];
    const n = (analysisObj.negatives || analysisObj.issues || []) as string[];
    const i = (analysisObj.improvement || analysisObj.improve || analysisObj.plan || []) as string[];
    const k = (analysisObj.keep || analysisObj.positivesPlan || []) as string[];
    return { positives: p || [], negatives: n || [], improve: i || [], keep: k || [], raw: JSON.stringify(analysisObj) };
  }

  const raw = aiAnalysis || '';
  if (!raw) return { positives: [], negatives: [], improve: [], keep: [], raw: '' };

  // 2) Try JSON.parse on raw text
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === 'object') {
      const p = (j.positives || j.strengths || []) as string[];
      const n = (j.negatives || j.issues || []) as string[];
      const i = (j.improvement || j.improve || j.plan || []) as string[];
      const k = (j.keep || j.leverage || []) as string[];
      return { positives: p || [], negatives: n || [], improve: i || [], keep: k || [], raw };
    }
  } catch {
    // not JSON; fall through to heuristics
  }

  // 3) Heuristic parse for free-form text with headings + bullets
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const sections: Record<string, string[]> = {
    positives: [],
    negatives: [],
    improve: [],
    keep: [],
  };

  let current: keyof typeof sections | null = null;
  for (const line of lines) {
    const lower = line.toLowerCase();

    // Heading detection
    if (/(^|\b)(positive|strengths)/.test(lower)) { current = 'positives'; continue; }
    if (/(^|\b)(negative|issues|concern)/.test(lower)) { current = 'negatives'; continue; }
    if (/(improvement|improve|action plan|fix)/.test(lower)) { current = 'improve'; continue; }
    if (/(keep|leverage|double down|maintain)/.test(lower)) { current = 'keep'; continue; }

    // Bullet/numbered lines become items for current section (if set)
    const bulletMatch = /^(\*|-|•|\d+[\.\)])\s*(.+)$/.exec(line);
    if (bulletMatch && current) {
      sections[current].push(bulletMatch[2]);
      continue;
    }

    // If line isn't a bullet but we're inside a section and it's short-ish, treat as item
    if (current && line.length <= 200 && !/^(reviews:|summary:)/i.test(line)) {
      sections[current].push(line);
    }
  }

  // Deduplicate + trim to top 5
  const uniq = (arr: string[]) => Array.from(new Set(arr.map(s => s.trim()))).filter(Boolean).slice(0, 5);

  return {
    positives: uniq(sections.positives),
    negatives: uniq(sections.negatives),
    improve: uniq(sections.improve),
    keep: uniq(sections.keep),
    raw,
  };
}

export default function AIAnalyzerPage() {
  const [placeInput, setPlaceInput] = useState('');
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResult | null>(null);
  const [showReviews, setShowReviews] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErr(null);
    setData(null);
    setShowReviews(false);

    const input = placeInput.trim();
    if (!input) {
      setErr('Paste a Google Maps link or type a business name.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/create-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeInput: input, days }),
      });
      const json: ApiResult = await res.json();
      if (!res.ok || json?.ok === false || json?.error) {
        setErr(json?.error || `Request failed (${res.status})`);
      } else {
        setData(json);
      }
    } catch (e: any) {
      setErr(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  const parsed = parseAiAnalysis(data?.aiAnalysis, (data as any)?.analysis);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">AI Review Analyzer</h1>

      <form onSubmit={run} className="grid gap-3 p-4 border rounded-2xl">
        <label className="text-sm font-medium">Business (Google Maps URL or Name)</label>
        <input
          value={placeInput}
          onChange={(e) => setPlaceInput(e.target.value)}
          placeholder="e.g., Camp Loughridge, Tulsa, OK or https://maps.app.goo.gl/..."
          className="w-full rounded-lg border px-3 py-2"
          autoComplete="off"
        />

        <label className="text-sm font-medium">Timeframe</label>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
          className="w-full sm:w-48 rounded-lg border px-3 py-2"
        >
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 365 days</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className={cn(
            'justify-self-start rounded-xl px-4 py-2 text-white',
            loading ? 'bg-gray-500' : 'bg-black hover:bg-gray-900'
          )}
        >
          {loading ? 'Analyzing…' : 'Run Analysis'}
        </button>

        {err && <div className="text-sm text-red-600">{err}</div>}
      </form>

      {data && (
        <div className="space-y-6">
          {/* Summary header */}
          <div className="grid gap-2 p-4 border rounded-2xl">
            <div className="text-sm text-gray-500">Business</div>
            <div className="text-lg font-semibold">
              {data.placeName || '(Name unavailable)'}
            </div>
            <div className="text-sm text-gray-600">
              {data.reviewCount ?? 0} reviews • Timeframe: {data.days} days • Source: {data.source || '—'}
            </div>
            {data.placeId && (
              <div className="text-xs text-gray-500 break-all">place_id: {data.placeId}</div>
            )}
          </div>

          {/* AI sections */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Top Positives" items={parsed.positives} accent="border-emerald-300" />
            <Card title="Top Negatives" items={parsed.negatives} accent="border-rose-300" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Improvement Plan" items={parsed.improve} accent="border-amber-300" />
            <Card title="Keep Doing / Leverage" items={parsed.keep} accent="border-sky-300" />
          </div>

          {/* Raw reviews toggle */}
          <div className="p-4 border rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="font-medium">Raw Reviews</div>
              <button
                onClick={() => setShowReviews(s => !s)}
                className="text-sm underline"
              >
                {showReviews ? 'Hide' : 'Show'}
              </button>
            </div>
            {showReviews && (
              <ul className="mt-3 list-disc pl-5 space-y-2">
                {(data.reviews || []).map((r, i) => (
                  <li key={i} className="text-sm text-gray-800">{r}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Raw AI text (debug) */}
          {parsed.raw && (
            <details className="p-4 border rounded-2xl">
              <summary className="cursor-pointer">AI Raw Output (debug)</summary>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{parsed.raw}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ title, items, accent }: { title: string; items: string[]; accent?: string }) {
  return (
    <div className={cn('p-4 border rounded-2xl', accent || '')}>
      <div className="font-semibold mb-2">{title}</div>
      {items && items.length ? (
        <ul className="list-disc pl-5 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="text-sm text-gray-800">{it}</li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-gray-500">No items detected.</div>
      )}
    </div>
  );
}
