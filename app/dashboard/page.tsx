// File: app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import Header from '../components/Header';
import Footer from '../components/Footer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Report {
  id: string;
  created_at: string;
  summary: string;
  url: string;
}

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data?.user?.email || '');
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
      if (error) setError(error.message);
      else setReports(data || []);
      setLoading(false);
    };
    fetchReports();
  }, []);

  const filteredReports = reports.filter((r) =>
    r.summary.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-white text-black">
      <Header />

      <section className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Your Dashboard</h1>
            <p className="text-sm text-gray-500">Welcome back, {userEmail}</p>
          </div>
          <div className="text-sm px-3 py-1 rounded-xl bg-black text-white">Plan: Starter</div>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border px-4 py-2 rounded-xl"
          />
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : filteredReports.length === 0 ? (
          <p>No reports found.</p>
        ) : (
          <ul className="space-y-4">
            {filteredReports.map((report) => (
              <li key={report.id} className="border p-4 rounded-xl shadow-sm">
                <p className="text-sm text-gray-500">{format(new Date(report.created_at), 'PPpp')}</p>
                <p className="text-lg font-medium mb-2">{report.summary}</p>
                <div className="flex gap-3">
                  <a
                    href={`/api/reports/${report.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Download
                  </a>
                  <a
                    href="#"
                    onClick={() => alert('Re-analyze not implemented yet')}
                    className="text-gray-600 hover:underline"
                  >
                    Re-analyze
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Footer />
    </main>
  );
}
