// File: app/ai-analyzer/page.tsx
'use client';

import { useState } from 'react';

export default function AIAnalyzerPage() {
  const [mapUrl, setMapUrl] = useState('');
  const [dateRange, setDateRange] = useState('30');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // client-side preview of what the backend will use
  const [resolving, setResolving] = useState(false);
  const [resolvedQuery, setResolvedQuery] = useState<string | null>(null);
  const [resolveErr, setResolveErr] = useState<string | null>(null);

  async function resolvePlace(input: string) {
    if (!input?.trim()) return;
    setResolving(true);
    setResolveErr(null);
    setResolvedQuery(null);
    try {
      const r = await fetch('/api/resolve-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const data = await r.json();
      if (!r.ok || data?.error) throw new Error(data?.error || `HTTP ${r.status}`);
      setResolvedQuery(data.query || null);
    } catch (e: any) {
      setResolveErr(e?.message || 'Failed to resolve place');
    } finally {
      setResolving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/analyze-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapUrl, dateRange }), // server still does final normalization
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      // if backend returned its final query, show it
      if (data?.input?.query) setResolvedQuery(data.input.query);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black px-4 py-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">AI Review Analyzer</h1>

      <form onSubmit={handleSubmit} className="space-y-4 mb-4">
        <label className="block text-sm font-medium">Business Link (Google Maps URL)</label>
        <input
          type="text"
          placeholder="Paste Google Maps link, embed code, or business name"
          value={mapUrl}
          onChange={(e) => setMapUrl(e.target.value)}
          onBlur={() => resolvePlace(mapUrl)}
          required
          className="w-full border px-4 py-2 rounded"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => resolvePlace(mapUrl)}
            disabled={resolving || !mapUrl.trim()}
            className="border px-3 py-2 rounded hover:bg-gray-100 disabled:opacity-60"
          >
            {resolving ? 'Resolving…' : 'Preview place_id'}
          </button>
          {resolvedQuery && (
            <span className="text-sm text-gray-600 truncate">Resolved query: <code className="bg-gray-100 px-1 py-0.5 rounded">{resolvedQuery}</code></span>
          )}
          {resolveErr && (
            <span className="text-sm text-red-600">{resolveErr}</span>
          )}
        </div>

        <label className="block text-sm font-medium">Timeframe</label>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="w-full border px-4 py-2 rounded"
        >
          <option value="1">Past Day</option>
          <option value="30">Past 30 Days</option>
          <option value="60">Past 60 Days</option>
          <option value="90">Past 90 Days</option>
          <option value="365">Past Year</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800 disabled:opacity-60"
        >
          {loading ? 'Analyzing…' : 'Run Analysis'}
        </button>
      </form>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {result && (
        <div className="space-y-6">
          {/* Show what backend actually used */}
          {result?.input?.query && (
            <p className="text-sm text-gray-600">Backend query: <code className="bg-gray-100 px-1 py-0.5 rounded">{result.input.query}</code></p>
          )}

          {!!result.analysis?.summary && (
            <div>
              <h2 className="text-2xl font-semibold mb-2">Summary</h2>
              <p className="text-gray-800">{result.analysis.summary}</p>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-semibold mb-2">Reviews Analyzed:</h2>
            <ul className="list-disc pl-6">
              {(result.reviews || []).map((review: string, i: number) => (
                <li key={i}>{review}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">Top 5 Positives:</h2>
            <ul className="list-disc pl-6">
              {(result.analysis?.positives || []).map((pos: string, i: number) => (
                <li key={i}>{pos}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">Top 5 Negatives:</h2>
            <ul className="list-disc pl-6">
              {(result.analysis?.negatives || []).map((neg: string, i: number) => (
                <li key={i}>{neg}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">Action Steps:</h2>
            <ul className="list-disc pl-6">
              {(result.analysis?.actions || []).map((act: string, i: number) => (
                <li key={i}>{act}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}

