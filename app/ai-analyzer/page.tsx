'use client';

import { useEffect, useState } from 'react';

type ResolvedInfo = {
  normalizedUrl?: string;
  placeId?: string;
  name?: string;
  error?: string;
};

export default function AIAnalyzerPage() {
  const [mapUrl, setMapUrl] = useState('');
  const [dateRange, setDateRange] = useState('30');
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolvedInfo | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Normalize/resolve to place_id on blur or when the user pastes
  async function resolvePlace(input: string) {
    if (!input) return;
    setResolving(true);
    setResolved(null);
    try {
      const r = await fetch('/api/resolve-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: input }),
      });
      const data: ResolvedInfo = await r.json();
      setResolved(data);
      if (data.error) setError(data.error);
      else setError(null);
    } catch (e: any) {
      setResolved({ error: e?.message || 'Failed to resolve place' });
      setError(e?.message || 'Failed to resolve place');
    } finally {
      setResolving(false);
    }
  }

  // trigger resolve when user leaves the field
  function handleBlur() {
    resolvePlace(mapUrl.trim());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: any = { mapUrl, dateRange };
      if (resolved?.placeId) payload.placeId = resolved.placeId;

      const res = await fetch('/api/analyze-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Analysis failed');
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black px-4 py-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">AI Analyzer</h1>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <label className="block text-sm font-medium">
          Business Link (Google Maps URL)
        </label>
        <textarea
          placeholder="Paste any Google Maps link or embed code"
          value={mapUrl}
          onChange={(e) => setMapUrl(e.target.value)}
          onBlur={handleBlur}
          rows={3}
          className="w-full border px-3 py-2 rounded"
        />

        <label className="block text-sm font-medium">Timeframe</label>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="1">Last 24 hours</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 365 days</option>
        </select>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => resolvePlace(mapUrl.trim())}
            disabled={!mapUrl || resolving}
            className="border px-4 py-2 rounded hover:bg-gray-100"
          >
            {resolving ? 'Resolving…' : 'Resolve Business'}
          </button>

          <button
            type="submit"
            disabled={loading || resolving || !mapUrl}
            className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800"
          >
            {loading ? 'Analyzing…' : 'Run Analysis'}
          </button>

          <button
            type="button"
            disabled={!result}
            onClick={async () => {
              if (!result) return;
              const r = await fetch('/api/analyze-reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  mapUrl,
                  dateRange,
                  placeId: resolved?.placeId,
                  exportPdf: true,
                  result, // send the already computed result for PDF export
                }),
              });
              const blob = await r.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'review-remedy-report.pdf';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="border px-4 py-2 rounded hover:bg-gray-100"
          >
            Export PDF
          </button>
        </div>
      </form>

      {/* Debug / confirmation for users */}
      {resolved && (
        <div className="text-sm rounded border p-3 bg-gray-50 mb-6">
          <p><strong>Detected Name:</strong> {resolved.name || '—'}</p>
          <p><strong>place_id:</strong> {resolved.placeId || '—'}</p>
          <p className="break-all">
            <strong>Normalized URL:</strong> {resolved.normalizedUrl || '—'}
          </p>
          {resolved.error && (
            <p className="text-red-600 mt-2">{resolved.error}</p>
          )}
        </div>
      )}

      {error && <p className="text-red-600 mb-6">{error}</p>}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {!!result.analysis?.summary && (
            <div>
              <h2 className="text-2xl font-semibold mb-2">Summary</h2>
              <p className="text-gray-800">{result.analysis.summary}</p>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-semibold mb-2">Reviews Analyzed</h2>
            <ul className="list-disc pl-6">
              {(result.reviews || []).map((review: string, i: number) => (
                <li key={i}>{review}</li>
              ))}
            </ul>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Top 5 Positives</h2>
              <ul className="list-disc pl-6">
                {(result.analysis?.positives || []).map((pos: string, i: number) => (
                  <li key={i}>{pos}</li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-2">Top 5 Negatives</h2>
              <ul className="list-disc pl-6">
                {(result.analysis?.negatives || []).map((neg: string, i: number) => (
                  <li key={i}>{neg}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">Action Steps</h2>
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
