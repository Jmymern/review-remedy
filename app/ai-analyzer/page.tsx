'use client';

import { useEffect, useRef, useState } from 'react';

type AnalyzerResult = {
  resolved?: { placeId?: string | null; queryParam?: string };
  reviews: string[];
  analysis: {
    summary?: string;
    positives: string[];
    negatives: string[];
    actions: string[];
  };
};

type ResolveResp = {
  normalizedUrl?: string;
  placeId?: string;
  name?: string;
  error?: string;
};

export default function AIAnalyzerPage() {
  const [input, setInput] = useState('');
  const [dateRange, setDateRange] = useState('30');

  // live resolver state
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolveResp | null>(null);
  const [resolveErr, setResolveErr] = useState<string | null>(null);

  // analysis state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceId = useRef<number | null>(null);

  // Debounced resolve on every input change
  useEffect(() => {
    if (debounceId.current) window.clearTimeout(debounceId.current);
    setResolveErr(null);
    setResolved(null);

    const trimmed = input.trim();
    if (!trimmed) return;

    debounceId.current = window.setTimeout(async () => {
      try {
        setResolving(true);
        const r = await fetch('/api/resolve-place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userInput: trimmed }),
        });
        const data: ResolveResp = await r.json();
        if (!r.ok || data.error) {
          setResolveErr(data.error || 'Could not resolve place.');
          setResolved(null);
        } else {
          setResolved(data);
        }
      } catch (e: any) {
        setResolveErr(e?.message || 'Resolve failed');
        setResolved(null);
      } finally {
        setResolving(false);
      }
    }, 450);

    return () => {
      if (debounceId.current) window.clearTimeout(debounceId.current);
    };
  }, [input]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/analyze-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapUrl: input.trim(),
          dateRange,
          // pass the resolved placeId if we have it
          placeId: resolved?.placeId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to analyze');
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function exportPdf() {
    if (!result) return;
    const res = await fetch('/api/analyze-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exportPdf: true, result }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || 'PDF export failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'review-remedy-report.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-white text-black px-4 py-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">AI Analyzer</h1>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <label className="block text-sm font-medium">Business Link (Google Maps URL)</label>
        <textarea
          rows={3}
          placeholder="Paste any Google Maps link (long, short, or embed) OR type the business name/address"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full border px-4 py-2 rounded"
          required
        />

        {/* live resolver status */}
        <div className="text-sm space-y-1">
          {resolving && <p className="text-gray-500">Resolving place…</p>}

          {!resolving && resolved?.placeId && (
            <>
              <p className="text-gray-700">
                Resolved <span className="font-semibold">{resolved.name || 'place'}</span> —{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded">place_id: {resolved.placeId}</code>
              </p>
              {/* <-- tiny tweak: show exactly what we will query */}
              <p className="text-xs text-gray-500">
                We’ll query:&nbsp;
                <code className="bg-gray-100 px-1 py-0.5 rounded">place_id:{resolved.placeId}</code> via
                Outscraper (async).
              </p>
            </>
          )}

          {!resolving && !resolved?.placeId && input.trim() && !resolveErr && (
            <p className="text-xs text-gray-500">
              We’ll first resolve this to a <code>place_id</code> and then run the review pull.
            </p>
          )}

          {!resolving && resolveErr && (
            <p className="text-red-600">Couldn’t resolve: {resolveErr}</p>
          )}
        </div>

        <div className="flex gap-3 items-center">
          <label className="text-sm font-medium">Timeframe</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border px-3 py-2 rounded"
          >
            <option value="1">Last 24 hours</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 365 days</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="ml-auto bg-black text-white px-5 py-2 rounded hover:bg-gray-800"
          >
            {loading ? 'Analyzing…' : 'Run Analysis'}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 border border-red-300 rounded px-3 py-2">
            {error}
          </p>
        )}
      </form>

      {!result && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Your Reports</h2>
          <p className="text-gray-600">No reports yet. Run your first analysis above.</p>
        </section>
      )}

      {result && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Analysis Result</h2>
            <button onClick={exportPdf} className="border px-4 py-2 rounded hover:bg-gray-50">
              Export PDF
            </button>
          </div>

          {result.analysis?.summary && (
            <div>
              <h3 className="text-lg font-semibold mb-1">Summary</h3>
              <p className="text-gray-800">{result.analysis.summary}</p>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-1">Reviews Analyzed</h3>
            <ul className="list-disc pl-6 space-y-1">
              {result.reviews.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Top 5 Positives</h3>
              <ul className="list-disc pl-6 space-y-1">
                {result.analysis.positives.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Top 5 Negatives</h3>
              <ul className="list-disc pl-6 space-y-1">
                {result.analysis.negatives.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-1">Action Steps</h3>
            <ul className="list-disc pl-6 space-y-1">
              {result.analysis.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
