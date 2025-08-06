// File: app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent } from '../components/ui/card';
import Header from '../components/Header';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Report {
  id: string;
  created_at: string;
  summary: string;
}

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('reports')
      .select('id, created_at, summary')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setReports(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen bg-white text-black">
      <Header />
      <section className="max-w-4xl mx-auto p-6">
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && reports.length === 0 && <p>No reports yet.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent>
                <div className="p-4">
                  <p className="text-sm text-gray-500">
                    {new Date(report.created_at).toLocaleDateString()}
                  </p>
                  <p className="mt-2">{report.summary}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
