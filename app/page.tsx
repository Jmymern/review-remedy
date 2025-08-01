'use client';

import { useEffect, useState } from 'react';
import { createClient, type User } from '@supabase/supabase-js';

/**
 * NOTE: This keeps your current client-side Supabase init exactly as-is.
 * When you have time, move these to env vars and rotate the anon key.
 */
const supabase = createClient(
  'https://tyqpgfjbjrcqmrisxvln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cXBnZmpianJjcW1yaXN4dmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjU3NTMsImV4cCI6MjA2Nzk0MTc1M30.izgyrjqeooALMd705IW28WLkDN_pyMbpuOTFr1zuAbk'
);

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingPlan, setLoadingPlan] =
    useState<null | 'charter' | 'starter' | 'pro' | 'business' | 'agency'>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(error ? null : (data.user ?? null));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- Start checkout for any plan ----
  async function startCheckout(plan: 'charter' | 'starter' | 'pro' | 'business' | 'agency') {
    try {
      // Ask users to log in first (so we can attach userId in metadata/webhook later)
      if (!user) {
        alert('Please log in before purchasing.');
        window.location.href = '/auth';
        return;
      }

      setLoadingPlan(plan);

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // include userId so it shows up as client_reference_id in Stripe
        body: JSON.stringify({ plan, userId: user.id }),
      });

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert('Could not start checkout.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Something went wrong. Try again.');
    } finally {
      setLoadingPlan(null);
    }
  }

  const busy = (p: string) => loadingPlan === p;

  return (
    <main className="min-h-screen bg-white text-black font-sans">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center py-20 px-6">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          “Your Reviews Are Talking — Are You Listening?”
        </h1>
        <p className="text-lg max-w-2xl">
          AI reads your Google Reviews, finds patterns in praise and complaints, and gives you
          a clear plan to grow faster and fix what’s costing you customers.
        </p>
      </section>

      {/* Beta / Charter CTA */}
      <section className="bg-gray-100 py-12 px-6 text-center">
        <h2 className="text-2xl font-semibold mb-4">🎉 Limited Beta Launch Offer</h2>
        <ul className="text-lg space-y-2 mb-6">
          <li>✅ $20/month — locked in for life</li>
          <li>⏱ Only 100 spots available</li>
          <li>💳 Includes AI Review Analyzer + Dashboard access</li>
          <li>🔒 No contracts. Cancel anytime.</li>
        </ul>

        <button
          onClick={() => startCheckout('charter')}
          className="bg-black text-white px-6 py-3 rounded-xl text-lg hover:bg-gray-800 transition"
          disabled={busy('charter')}
        >
          {busy('charter') ? 'Loading…' : '👉 Join the Beta – Lock in $20/month'}
        </button>
      </section>

      {/* Why section */}
      <section className="py-16 px-6 max-w-4xl mx-auto text-left">
        <h3 className="text-2xl font-semibold mb-6 text-center">📊 Why Review Remedy?</h3>
        <ul className="space-y-4 text-lg">
          <li>🧠 <strong>AI-Powered Review Analysis</strong> — Summarizes your top 5 good + top 5 bad Google reviews.</li>
          <li>📈 <strong>Clear Action Plan</strong> — Know exactly what to improve and what to double down on.</li>
          <li>🔎 <strong>Track What Matters</strong> — Use your dashboard to monitor trends in customer experience.</li>
          <li>🏆 <strong>Stay Ahead</strong> — Fix reputation issues before they cost you real business.</li>
        </ul>
      </section>

      {/* Plan buttons */}
      <section className="py-10 px-6 text-center">
        <h4 className="text-xl font-semibold mb-4">Choose your plan</h4>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => startCheckout('starter')}
            className="border rounded-xl px-5 py-2 hover:bg-gray-50"
            disabled={busy('starter')}
            aria-label="Choose Starter plan"
          >
            {busy('starter') ? 'Starting…' : 'Starter'}
          </button>

          <button
            onClick={() => startCheckout('pro')}
            className="border rounded-xl px-5 py-2 hover:bg-gray-50"
            disabled={busy('pro')}
            aria-label="Choose Pro plan"
          >
            {busy('pro') ? 'Starting…' : 'Pro'}
          </button>

          <button
            onClick={() => startCheckout('business')}
            className="border rounded-xl px-5 py-2 hover:bg-gray-50"
            disabled={busy('business')}
            aria-label="Choose Business plan"
          >
            {busy('business') ? 'Starting…' : 'Business'}
          </button>

          <button
            onClick={() => startCheckout('agency')}
            className="border rounded-xl px-5 py-2 hover:bg-gray-50"
            disabled={busy('agency')}
            aria-label="Choose Agency plan"
          >
            {busy('agency') ? 'Starting…' : 'Agency'}
          </button>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-black text-white py-12 px-6 text-center">
        <h2 className="text-2xl font-bold mb-4">👉 Get Instant Insights – Lock in Your Lifetime Price</h2>
        <button
          onClick={() => startCheckout('charter')}
          className="mt-4 bg-white text-black px-6 py-3 rounded-xl text-lg hover:bg-gray-200 transition"
          disabled={busy('charter')}
        >
          {busy('charter') ? 'Redirecting…' : 'Join Now for $20/month'}
        </button>
      </section>
    </main>
  );
}
