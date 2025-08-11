'use client';
import { useState } from 'react';

export default function AIAnalyzerPage() {
  const [placeInput, setPlaceInput] = useState('');
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<any>(null);

  async function runAnalysis(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const raw = placeInput.trim();
    if (!raw) {
      setError('Please paste a Google Maps URL or type the business name.');
      return;
    }

    setLoading(true);
    setError(null);
    setResp(null);

    try {
      const res = await fetch('/api/create-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeInput: raw, days }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Request failed (${res.status})`);
      } else {
        setResp(data);
      }
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">AI Analyzer</h1>
      <form onSubmit={runAnalysis} className="space-y-3 p-4 border rounded-lg">
        <label className="block text-sm font-medium">Business Link (Google Maps URL)</label>
        <input
          type="text"
          value={placeInput}
          onChange={(e) => setPlaceInput(e.target.value)}
          placeholder="Paste Google Maps URL or type business name"
          className="w-full rounded border px-3 py-2"
          autoComplete="off"
        />

        <label className="block text-sm font-medium">Timeframe</label>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
          className="rounded border px-3 py-2"
        >
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 365 days</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-60"
        >
          {loading ? 'Running…' : 'Run Analysis'}
        </button>

        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>

      {resp && (
        <div className="mt-6 p-4 border rounded">
          <div className="text-sm"><b>OK:</b> {String(resp.ok)}</div>
          <div className="text-sm"><b>Place:</b> {resp.placeName || resp.placeId}</div>
          <div className="text-sm"><b>Reviews:</b> {resp.reviewCount}</div>
        </div>
      )}
    </div>
  );
}
