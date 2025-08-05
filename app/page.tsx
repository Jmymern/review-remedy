// File: app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient, type User } from '@supabase/supabase-js';
import Header from './components/Header';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Plan = 'charter' | 'starter' | 'pro' | 'business' | 'agency';

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(error ? null : (data?.user ?? null));
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <main className="min-h-screen bg-white text-black">
      <Header />

      {/* HERO */}
      <section className="flex flex-col items-center justify-center text-center py-20 px-6">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          “Your Reviews Are Talking — Are You Listening?”
        </h1>
        <p className="text-lg max-w-2xl">
          AI reads your Google Reviews, finds patterns in praise and complaints, and
          gives you a clear plan to grow faster and fix what’s costing you customers.
        </p>
        <a
          href="/plans"
          className="mt-6 bg-black text-white px-6 py-3 rounded-xl text-lg hover:bg-gray-800 transition"
        >
          See All Pricing Plans
        </a>
      </section>

      {/* WHY SECTION */}
      <section className="py-16 px-6 max-w-4xl mx-auto text-left">
        <h3 className="text-2xl font-semibold mb-6 text-center">📊 Why Review Remedy?</h3>
        <ul className="space-y-4 text-lg">
          <li>🧠 <strong>AI-Powered Review Analysis</strong> — Summarizes your top 5 good + top 5 bad Google reviews.</li>
          <li>📈 <strong>Clear Action Plan</strong> — Know exactly what to improve and what to double down on.</li>
          <li>🔎 <strong>Track What Matters</strong> — Use your dashboard to monitor trends in customer experience.</li>
          <li>🏆 <strong>Stay Ahead</strong> — Fix reputation issues before they cost you real business.</li>
        </ul>
      </section>

      {/* CTA */}
      <section className="bg-black text-white py-12 px-6 text-center">
        <h2 className="text-2xl font-bold mb-4">👉 Get Instant Insights – Lock in Your Lifetime Price</h2>
        <a
          href="/plans"
          className="mt-4 inline-block bg-white text-black px-6 py-3 rounded-xl text-lg hover:bg-gray-200 transition"
        >
          Join Now for $20/month
        </a>
      </section>
    </main>
  );
}
