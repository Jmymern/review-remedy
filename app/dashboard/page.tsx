'use client';

import { useEffect, useState } from 'react';

type Report = {
  id: string;
  business_name: string | null;
  business_url: string | null;
  time_range: string | null;
  positives: string[];       // normalized to array
  negatives: string[];       // normalized to array
  suggestions: string | null;
  created_at: string | null;
  status: string | null;
  error: string | null;
};

export default function DashboardPage() {
  // ---- form state
  const [gmapsUrl, setGmapsUrl] = useState('');
  const [bizName, setBizName] = useState('');
  const [timeRange, setTimeRange] = useState('90');

  // ---- UI state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- data
  const [reports, setReports] = useState<Report[]>([]);

  // ---------- helpers ----------
  function looksLikeGmaps(url: string) {
    const u = url.trim();
    return (
      u.includes('google.com/maps') ||
      u.includes('maps.app.goo.gl')
    );
  }

  function normalize(list: any[]): Report[] {
    return (list || [])
      .map((r: any, i: number) => {
        const id =
          String(r?.id ?? '') ||
          `${r?.created_at ?? 'no-date'}-${i}`;

        const business_name =
          (r?.business_name ?? r?.report_name ?? '').toString() || null;

        const positives: string[] =
          Array.isArray(r?.positives)
            ? r.positives.map(String)
            : (r?.top_positive ? [String(r.top_positive)] : []);

        const negatives: string[] =
          Array.isArray(r?.negatives)
            ? r.negatives.map(String)
            : (r?.top_complaint ? [String(r.top_complaint)] : []);

        const suggestions =
          r?.suggestions != null ? String(r.suggestions) : null;

        // filter out pure-empty placeholder rows later
        return {
          id,
          business_name,
          business_url: r?.business_url ?? null,
          time_range: r?.time_range ?? null,
          positives,
          negatives,
          suggestions,
          created_at: r?.created_at ?? null,
          status: r?.status ?? null,
          error: r?.error ?? null,
        } as Report;
      })
      .filter((r: Report) => {
        // keep if it has a name OR any content
        const hasContent =
          (r.positives && r.positives.length > 0) ||
          (r.negatives && r.negatives.length > 0) ||
          (r.suggestions && r.suggestions.trim().length > 0);
        return Boolean(r.business_name) || hasContent;
      })
      .sort((a, b) => {
        // newest first by created_at (fallback to id)
        const da = a.created_at ? Date.parse(a.created_at) : 0;
        const db = b.created_at ? Date.parse(b.created_at) : 0;
        return db - da;
      });
  }

async function fetchReports() {
  setError(null);
  try {
    const res = await fetch('/api/dashboard-data', {
      cache: 'no-store',
      headers: { 'x-no-cache': Date.now().toString() },
    });
    if (!res.ok) throw new Error(`Failed to load reports (${res.status})`);

    const json = await res.json();

    // Prefer json.reports first, fallback to json.data.reports
    const list = json?.reports ?? json?.data?.reports ?? [];

    // Keep only objects
    const safe = Array.isArray(list) ? list.filter((x: any) => x && typeof x === 'object') : [];

    setReports(safe);
  } catch (e: any) {
    setError(e?.message || 'Failed to load reports');
    setReports([]);
  }
}


  useEffect(() => {
    fetchReports();
  }, []);

  // ---------- actions ----------
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!looksLikeGmaps(gmapsUrl)) {
      setError('Please paste a valid Google Maps link (Share → Copy link).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/create-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_url: gmapsUrl.trim(),
          business_name: bizName.trim() || null,
          time_range: timeRange,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Failed to create report (${res.status})`);
      }

      // clear the form
      setGmapsUrl('');
      setBizName('');
      setTimeRange('90');

      // pull fresh data
      await fetchReports();
      // focus scroll to list
      setTimeout(() => {
        const el = document.getElementById('reports-list');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }

  // ---------- UI ----------
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      {/* Charter Badge */}
      <div className="rounded-xl border p-4 bg-white flex items-center justify-between">
        <div>
          <div className="text-sm uppercase tracking-wide text-gray-500">Beta Charter Member</div>
          <div className="text-base">You’re locked at <strong>$20/mo</strong> for life.</div>
        </div>
        <a href="/pricing" className="text-sm underline">Manage plan</a>
      </div>

      {/* Intake Form */}
      <form onSubmit={onSubmit} className="rounded-2xl border p-6 bg-white space-y-4">
        <h2 className="text-xl font-semibold">Analyze Your Google Reviews</h2>
        <p className="text-sm text-gray-600">
          Paste your Google Maps link (Share → Copy link). We’ll fetch reviews for the selected time range and build a clear action plan.
        </p>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Google Maps URL</label>
          <input
            value={gmapsUrl}
            onChange={(e) => setGmapsUrl(e.target.value)}
            placeholder="https://www.google.com/maps/place/... or https://maps.app.goo.gl/..."
            className="w-full rounded-lg border px-3 py-2"
            required
          />
          <p className="text-xs text-gray-500">
            Works with <code>/maps/place</code>, <code>/maps/dir</code>, and <code>maps.app.goo.gl</code> short links.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Business Name (optional)</label>
            <input
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              placeholder="Jiffy Lube 2111 W Washington St S, Broken Arrow, OK"
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 365 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg px-4 py-2 border bg-black text-white"
        >
          {loading ? 'Analyzing…' : 'Analyze My Reviews'}
        </button>
      </form>

      {/* Results */}
      <div className="space-y-4" id="reports-list">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Latest Reports</h3>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-sm underline"
          >
            {refreshing ? 'Refreshing…' : 'Refresh reports'}
          </button>
        </div>

        {reports.length === 0 && (
          <div className="text-sm text-gray-500">No reports yet. Run your first analysis above.</div>
        )}

        <div className="grid gap-4">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border p-4 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.business_name || 'Unnamed business'}</div>
                <div className="text-xs text-gray-500">
                  {r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : ''}
                </div>
              </div>
              {r.business_url && (
                <div className="text-sm text-gray-600 break-all">{r.business_url}</div>
              )}

              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Top 5 Positives</div>
                  <ul className="list-disc ml-4">
                    {(r.positives ?? []).slice(0, 5).map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Top 5 Complaints</div>
                  <ul className="list-disc ml-4">
                    {(r.negatives ?? []).slice(0, 5).map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Suggested Fixes</div>
                  <div className="whitespace-pre-line">{r.suggestions || ''}</div>
                </div>
              </div>

              {r.status === 'error' && (
                <div className="text-sm text-red-600">Error: {r.error}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
