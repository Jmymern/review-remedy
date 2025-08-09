// File: app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient, type User } from '@supabase/supabase-js';
import { Card, CardContent } from '../components/ui/card';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Timeframe = '1' | '30' | '60' | '90' | '365';

interface Report {
  id: string;
  user_id: string;
  created_at: string;
  summary: string;
  positives?: string[] | null;
  negatives?: string[] | null;
  suggestions?: string[] | null;
  timeframe?: string | null;
  place_url?: string | null;
}

export default function AIAnalyzerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [placeUrl, setPlaceUrl] = useState('');
  const [days, setDays] = useState<Timeframe>('30');
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  useEffect(() => {
    // load existing reports for this user
    async function load() {
      setLoadingReports(true);
      setErr(null);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoadingReports(false);
        return;
      }
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) setErr(error.message);
      setReports(data || []);
      setLoadingReports(false);
    }
    load();
  }, []);

  async function runAnalysis(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!user) {
      setErr('Please log in first.');
      return;
    }
    if (!placeUrl.trim()) {
      setErr('Please paste a valid business link.');
      return;
    }

    setRunning(true);
    try {
      // 1) Ask our API to pull reviews + get AI summary (no DB write on server)
      const res = await fetch('/api/create-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeUrl: placeUrl.trim(),
          days: Number(days),
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to analyze.');
      }

      const payload = await res.json() as {
        summary: string;
        positives: string[];
        negatives: string[];
        suggestions: string[];
      };

      // 2) Save to Supabase from client (uses the logged-in session + RLS)
      const insert = await supabase
        .from('reports')
        .insert({
          user_id: user.id,
          summary: payload.summary,
          positives: payload.positives,
          negatives: payload.negatives,
          suggestions: payload.suggestions,
          timeframe: String(days),
          place_url: placeUrl.trim(),
        })
        .select('*')
        .single();

      if (insert.error) throw insert.error;

      // 3) Prepend to the UI list
      setReports((prev) => [insert.data as Report, ...prev]);
      setPlaceUrl('');
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">AI Analyzer</h1>

        {/* Intake form */}
        <form onSubmit={runAnalysis} className="border rounded-2xl p-4 mb-8">
          <label className="block text-sm font-medium mb-2">
            Business Link (Google Maps URL)
          </label>
          <input
            value={placeUrl}
            onChange={(e) => setPlaceUrl(e.target.value)}
            className="w-full border rounded-xl px-4 py-2"
            placeholder="Paste Google Maps business link"
          />

          <div className="mt-4 flex items-center gap-4">
            <label className="text-sm font-medium">Timeframe</label>
            <select
              value={days}
              onChange={(e) => setDays(e.target.value as Timeframe)}
              className="border rounded-xl px-3 py-2"
            >
              <option value="1">Today</option>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 365 days</option>
            </select>

            <button
              disabled={running}
              className="ml-auto bg-black text-white px-5 py-2 rounded-xl hover:bg-gray-800 disabled:opacity-60"
            >
              {running ? 'Analyzing…' : 'Run Analysis'}
            </button>
          </div>

          {err && <p className="text-red-600 text-sm mt-3">{err}</p>}
        </form>

        {/* Reports list */}
        <h2 className="text-xl font-semibold mb-4">Your Reports</h2>
        {loadingReports ? (
          <p>Loading reports…</p>
        ) : reports.length === 0 ? (
          <p>No reports yet. Run your first analysis above.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {reports.map((report) => (
              <Card key={report.id}>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">
                    {new Date(report.created_at).toLocaleDateString()} •{' '}
                    {report.timeframe ? `${report.timeframe}d` : ''}
                  </p>
                  {report.place_url && (
                    <p className="text-xs text-gray-500 truncate">
                      {report.place_url}
                    </p>
                  )}

                  <p className="mt-3 font-semibold">Summary</p>
                  <p className="text-sm mt-1">{report.summary}</p>

                  {report.positives && report.positives.length > 0 && (
                    <>
                      <p className="mt-3 font-semibold">Top 5 Positives</p>
                      <ul className="list-disc pl-5 text-sm mt-1 space-y-1">
                        {report.positives.slice(0, 5).map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {report.negatives && report.negatives.length > 0 && (
                    <>
                      <p className="mt-3 font-semibold">Top 5 Complaints</p>
                      <ul className="list-disc pl-5 text-sm mt-1 space-y-1">
                        {report.negatives.slice(0, 5).map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {report.suggestions && report.suggestions.length > 0 && (
                    <>
                      <p className="mt-3 font-semibold">Action Plan</p>
                      <ul className="list-disc pl-5 text-sm mt-1 space-y-1">
                        {report.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
