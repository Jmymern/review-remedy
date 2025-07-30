// frontend/app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";

type Report = {
  id: string;
  business_name: string | null;
  business_url: string | null;
  time_range: string | null;
  positives?: any;
  negatives?: any;
  suggestions?: string | null;
  created_at?: string | null;
  status?: string | null;
  error?: string | null;
};

export default function DashboardPage() {
  const [gmapsUrl, setGmapsUrl] = useState("");
  const [bizName, setBizName] = useState("");
  const [timeRange, setTimeRange] = useState("90");
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchReports() {
    // You already have /api/dashboard-data working; reuse it
    const res = await fetch("/api/dashboard-data", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setReports(data?.reports || []);
  }

  useEffect(() => {
    fetchReports();
  }, []);

  function looksLikeGmaps(url: string) {
    return url.includes("google.com/maps");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!looksLikeGmaps(gmapsUrl)) {
      setError("Please paste a valid public Google Maps URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/create-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_url: gmapsUrl,
          business_name: bizName || null,
          time_range: timeRange,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to create report");
      }
      await fetchReports();
      setGmapsUrl("");
      setBizName("");
      setTimeRange("90");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      {/* Charter Badge */}
      <div className="rounded-xl border p-4 bg-white flex items-center justify-between">
        <div>
          <div className="text-sm uppercase tracking-wide text-gray-500">Beta Charter Member</div>
          <div className="text-base">You’re locked at <strong>$20/mo for life</strong>.</div>
        </div>
        <a href="/pricing" className="text-sm underline">Manage plan</a>
      </div>

      {/* Intake Form */}
      <form onSubmit={onSubmit} className="rounded-2xl border p-6 bg-white space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Analyze Your Google Reviews</h2>
          <p className="text-sm text-gray-600">
            Paste your public Google Maps link. We’ll fetch reviews for the selected time range and generate a clear action plan.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Google Maps URL *</label>
          <input
            value={gmapsUrl}
            onChange={(e) => setGmapsUrl(e.target.value)}
            placeholder="https://www.google.com/maps/place/Your+Business/..."
            className="w-full rounded-lg border px-3 py-2"
            required
          />
          <p className="text-xs text-gray-500">Example: Open your business on Google Maps, copy the URL, and paste it here.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Business Name (optional)</label>
            <input
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              placeholder="Tulsa Coffee Co."
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
          {loading ? "Analyzing…" : "Analyze My Reviews"}
        </button>

        {loading && (
          <div className="text-xs text-gray-500 mt-2">
            Fetching reviews → Summarizing → Building your action plan…
          </div>
        )}
      </form>

      {/* Results List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Latest Reports</h3>
        {reports.length === 0 && (
          <div className="text-sm text-gray-500">No reports yet. Run your first analysis above.</div>
        )}
        <div className="grid gap-4">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border p-4 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.business_name || "Unnamed Business"}</div>
                <div className="text-xs text-gray-500">{r.created_at?.slice(0, 10)} • {r.time_range || "n/a"} days</div>
              </div>
              <div className="text-sm text-gray-600 break-all">{r.business_url}</div>

              {/* Summary Cards (optional simple render) */}
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Top 5 Positives</div>
                  <ul className="list-disc ml-4">
                    {(r.positives || []).slice(0,5).map((p:any, i:number) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Top 5 Complaints</div>
                  <ul className="list-disc ml-4">
                    {(r.negatives || []).slice(0,5).map((n:any, i:number) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Suggested Fixes</div>
                  <div className="whitespace-pre-line">{r.suggestions || "—"}</div>
                </div>
              </div>

              {r.status === "error" && <div className="text-red-600 text-sm">Error: {r.error}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
