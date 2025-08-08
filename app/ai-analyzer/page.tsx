// File: app/ai-analyzer/page.tsx
'use client';

import { useState } from 'react';

export default function AIAnalyzerPage() {
  const [mapUrl, setMapUrl] = useState('');
  const [dateRange, setDateRange] = useState('30');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/analyze-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapUrl, dateRange }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }

      const data = await res.json();
      // attach the input we used so Save can include it
      setResult({ ...data, input: { mapUrl, dateRange } });
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result?.analysis) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: result.analysis.summary,
          positives: result.analysis.positives,
          negatives: result.analysis.negatives,
          actions: result.analysis.actions,
          placeUrl: result.input?.mapUrl || '',
          timeframe: result.input?.dateRange || '',
        }),
      });

      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || 'Save failed');
      setSaveMsg('Saved to your reports.');
    } catch (e: any) {
      setSaveMsg(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadPdf() {
    if (!result?.analysis) return;

    const { analysis, reviews, input } = result;

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Review Remedy — Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
    h1,h2 { margin: 0 0 8px; }
    h1 { font-size: 22px; }
    h2 { font-size: 16px; margin-top: 20px; }
    p, li { font-size: 12px; line-height: 1.5; }
    .meta { color: #555; font-size: 12px; margin-bottom: 12px; }
    .section { margin-top: 16px; }
    ul { padding-left: 20px; margin: 6px 0; }
    .muted { color: #666; }
    .divider { height: 1px; background: #ddd; margin: 16px 0; }
  </style>
</head>
<body>
  <h1>AI Review Analysis</h1>
  <div class="meta">
    <div><strong>Business Link:</strong> ${escapeHtml(input?.mapUrl || '')}</div>
    <div><strong>Timeframe:</strong> ${escapeHtml(input?.dateRange || '')} days</div>
    <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
  </div>

  ${analysis?.summary ? `<div class="section"><h2>Summary</h2><p>${escapeHtml(analysis.summary)}</p></div>` : ''}

  <div class="section">
    <h2>Top 5 Positives</h2>
    ${renderList(analysis?.positives)}
  </div>

  <div class="section">
    <h2>Top 5 Negatives</h2>
    ${renderList(analysis?.negatives)}
  </div>

  <div class="section">
    <h2>Action Steps</h2>
    ${renderList(analysis?.actions)}
  </div>

  <div class="divider"></div>

  <div class="section">
    <h2>Reviews Analyzed</h2>
    ${renderList(reviews)}
  </div>

  <script>
    window.onload = () => window.print();
  </script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return alert('Please allow popups to download the PDF.');
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  return (
    <main className="min-h-screen bg-white text-black px-4 py-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">AI Review Analyzer</h1>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <input
          type="text"
          placeholder="Paste Google Maps business link"
          value={mapUrl}
          onChange={(e) => setMapUrl(e.target.value)}
          required
          className="w-full border px-4 py-2 rounded"
        />
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
          {loading ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </form>

      {error && <p className="text-red-600">{error}</p>}

      {result && (
        <div className="space-y-6">
          {!!result.analysis?.summary && (
            <div>
              <h2 className="text-2xl font-semibold mb-2">Summary</h2>
              <p className="text-gray-800">{result.analysis.summary}</p>
            </div>
          )}

          <div className="flex gap-3 mb-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Report'}
            </button>
            <button
              onClick={handleDownloadPdf}
              className="border px-4 py-2 rounded hover:bg-gray-100"
            >
              Download PDF
            </button>
            {saveMsg && (
              <span className="text-sm text-gray-600 self-center">{saveMsg}</span>
            )}
          </div>

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

// ---------- helpers (kept here for simplicity) ----------
function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderList(items?: string[]) {
  if (!items || !items.length) return '<p class="muted">None.</p>';
  return `<ul>${items.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
}
