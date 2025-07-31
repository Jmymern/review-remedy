'use client';

import React, { useEffect, useRef, useState } from 'react';

type Report = {
  id: string;
  business_name: string | null;
  business_url: string | null;
  time_range: string | null;
  positives: string[];
  negatives: string[];
  suggestions: string | null;
  created_at: string | null;
  status: 'processing' | 'completed' | 'error' | string | null;
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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // ---------- helpers ----------
  function looksLikeGmaps(url: string) {
    const u = url.trim();
    return u.includes('google.com/maps') || u.includes('maps.app.goo.gl');
  }

  function toArray(x: any): string[] {
    if (!x) return [];
    if (Array.isArray(x)) return x.map(String).filter(Boolean);
    return [String(x)].filter(Boolean);
  }

  function normalizeOne(raw: any, idx: number): Report {
    const id = String(raw?.id ?? '') || `${raw?.created_at ?? 'no-date'}-${idx}`;
    const name =
      (raw?.business_name ?? raw?.report_name ?? '').toString() || null;

    const positives = toArray(raw?.positives);
    const negatives = toArray(raw?.negatives);
    const suggestions =
      raw?.suggestions != null ? String(raw.suggestions) : null;

    return {
      id,
      business_name: name,
      business_url: raw?.business_url ?? null,
      time_range: raw?.time_range ?? null,
      positives,
      negatives,
      suggestions,
      created_at: raw?.created_at ?? null,
      status: (raw?.status as any) ?? null,
      error: raw?.error ?? null,
    };
  }

  // filter placeholders (old mock text or missing content)
  function isReal(r: Report) {
    const hasAny =
      (r.positives && r.positives.length) ||
      (r.negatives && r.negatives.length) ||
      (r.suggestions && r.suggestions.trim().length);

    const looksPlaceholder =
      (r.suggestions || '').includes('OPENAI_API_KEY');

    return (Boolean(r.business_name) || hasAny) && !looksPlaceholder;
  }

  function sortNewest(a: Report, b: Report) {
    const da = a.created_at ? Date.parse(a.created_at) : 0;
    const db = b.created_at ? Date.parse(b.created_at) : 0;
    return db - da;
  }

  function dedupeByBusinessUrl(list: Report[]): Report[] {
    const m = new Map<string, Report>();
    for (const r of list) {
      const key = (r.business_url || '').trim() || `id:${r.id}`;
      const prev = m.get(key);
      // keep the newest
      if (!prev || sortNewest(r, prev) < 0) {
        // (we already sort newest desc later, so just set; we'll re-sort)
      }
      m.set(key, r);
    }
    return Array.from(m.values()).sort(sortNewest);
  }

  // ---------- data load ----------
  async function fetchReports() {
    setError(null);
    try {
      const res = await fetch('/api/dashboard-data', {
        cache: 'no-store',
        headers: { 'x-no-cache': Date.now().toString() },
      });
      if (!res.ok) throw new Error(`Failed to load reports (${res.status})`);
      const json = await res.json();

      const listRaw =
        (json?.reports && Array.isArray(json.reports) && json.reports) ||
        (json?.data?.reports && Array.isArray(json.data.reports) && json.data.reports) ||
        [];

      const safe = (listRaw || [])
        .filter((x: any) => x && typeof x === 'object')
        .map(normalizeOne)
        .filter(isReal)
        .sort(sortNewest);

      setReports(dedupeByBusinessUrl(safe));
    } catch (e: any) {
      setError(e?.message || 'Failed to load reports');
      setReports([]);
    }
  }

  useEffect(() => {
    fetchReports();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
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

      // clear form
      setGmapsUrl('');
      setBizName('');
      setTimeRange('90');

      // immediate fetch + short polling for the newest row
      await fetchReports();
      startSmartPolling();

      // scroll to list
      setTimeout(() => {
        document.getElementById('reports-list')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 50);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // poll for up to ~45s until newest report is completed/error
  function startSmartPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const end = Date.now() + 45_000;
    pollingRef.current = setInterval(async () => {
      await fetchReports();
      const newest = reports[0];
      const done =
        newest && (newest.status === 'completed' || newest.status === 'error');
      if (done || Date.now() > end) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, 4000);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }

  async function onRerun(url: string | null, name?: string | null) {
    if (!url) return;
    setRefreshing(true);
    try {
      await fetch('/api/create-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_url: url,
          business_name: name || null,
          time_range: '90',
        }),
      });
      await fetchReports();
      startSmartPolling();
    } finally {
      setRefreshing(false);
    }
  }

  async function onDelete(id: string) {
    if (!id) return;
    if (!confirm('Delete this report?')) return;
    setRefreshing(true);
    try {
      await fetch(`/api/reports/${id}`, { method: 'DELETE' });
      await fetchReports();
    } finally {
      setRefreshing(false);
    }
  }

  // ---------- UI ----------
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      {/* Charter Badge */}
      <div className="rounded-xl border p-4 bg-white flex items-center justify-between">
        <div>
          <div className="text-sm uppercase tracking-wide text-gray-500">
            Beta Charter Member
          </div>
          <div className="text-base">
            You’re locked at <strong>$20/mo</strong> for life.
          </div>
        </div>
        <a href="/pricing" className="text-sm underline">
          Manage plan
        </a>
      </div>

      {/* Intake Form */}
      <form onSubmit={onSubmit} className="rounded-2xl border p-6 bg-white space-y-4">
        <h2 className="text-xl font-semibold">Analyze Your Google Reviews</h2>
        <p className="text-sm text-gray-600">
          Paste your Google Maps link (Share → Copy link). We’ll fetch reviews for the selected time
          range and build a clear action plan.
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
                <div className="font-semibold">
                  {r.business_name || 'Unnamed business'}
                </div>
                <div className="flex items-center gap-3">
                  {/* Status pill */}
                  {r.status && (
                    <span
                      className={[
                        'text-xs px-2 py-1 rounded-full border',
                        r.status === 'completed'
                          ? 'bg-green-50 text-green-700 border-green-300'
                          : r.status === 'processing'
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                          : 'bg-red-50 text-red-700 border-red-300',
                      ].join(' ')}
                    >
                      {r.status}
                    </span>
                  )}
                  <div className="text-xs text-gray-500">
                    {r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : ''}
                  </div>
                </div>
              </div>

              {r.business_url && (
                <div className="text-sm text-gray-600 break-all">
                  <a className="underline" href={r.business_url} target="_blank" rel="noreferrer">
                    {r.business_url}
                  </a>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Top 5 Positives</div>
                  <ul className="list-disc ml-4">
                    {(r.positives ?? []).slice(0, 5).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Top 5 Complaints</div>
                  <ul className="list-disc ml-4">
                    {(r.negatives ?? []).slice(0, 5).map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Suggested Fixes</div>
                  <div className="whitespace-pre-line">
                    {r.suggestions || ''}
                  </div>
                </div>
              </div>

              {r.error && (
                <div className="text-sm text-red-600">Error: {r.error}</div>
              )}

              <div className="flex items-center gap-4 text-sm pt-1">
                <button
                  className="underline"
                  onClick={() => onRerun(r.business_url, r.business_name)}
                  disabled={refreshing}
                >
                  Run again
                </button>
                <button
                  className="text-red-600 underline"
                  onClick={() => onDelete(r.id)}
                  disabled={refreshing}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
