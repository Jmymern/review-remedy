// File: app/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { createClient, type User } from '@supabase/supabase-js';
import Header from '../components/Header';
import Footer from '../components/Footer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        window.location.href = '/login';
      } else {
        setUser(data.user);
        supabase.from('reports').select('*')
          .eq('user_id', data.user.id)
          .order('created_at', { ascending: false })
          .then(({ data, error }) => {
            if (error) setError(error.message);
            else setReports(data || []);
            setLoading(false);
          });
      }
    });
  }, []);

  return (
    <main className="min-h-screen bg-white text-black">
      <Header />
      <section className="max-w-5xl mx-auto px-6 py-12">
        {loading && <p>Loading your reports…</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && reports.length === 0 && (
          <p>No reports found. Dashboard will show your AI analysis once you sign up or upload reviews.</p>
        )}
        {!loading && reports.length > 0 && (
          <ul className="space-y-4">
            {reports.map((r: any) => (
              <li key={r.id} className="border p-4 rounded-xl shadow-sm">
                <p className="text-sm text-gray-500">{new Date(r.created_at).toLocaleString()}</p>
                <p className="font-medium">{r.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Footer />
    </main>
  );
}
