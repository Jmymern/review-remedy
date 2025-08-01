'use client';

import { useEffect, useState } from 'react';
import { createClient, type User } from '@supabase/supabase-js';

// --- Supabase client (same as your current) ---
const supabase = createClient(
  'https://tyqpgfjbjrcqmrisxvln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cXBnZmpianJjcW1yaXN4dmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjU3NTMsImV4cCI6MjA2Nzk0MTc1M30.izgyrjqeooALMd705IW28WLkDN_pyMbpuOTFr1zuAbk'
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

  // ---- Start Stripe Checkout for the selected plan ----
  async function startCheckout(plan: Plan) {
    if (!user) {
      alert('Please log in before purchasing.');
      window.location.href = '/login'; // your app has /login
      return;
    }

    try {
      setLoadingPlan(plan);
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }), // send selected plan
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert('Could not start checkout.');
      }
    } catch (e) {
      console.error('checkout error', e);
      alert('Something went wrong. Try again.');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black font-sans">
      {/* HERO */}
      <section className="flex flex-col items-center justify-center text-center py-20 px-6">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          “Your Reviews Are Talking — Are You Listening?”
        </h1>
        <p className="text-lg max-w-2xl">
          AI reads your Google Reviews, finds patterns in praise and complaints, and
          gives you a clear plan to grow faster and fix what’s costing you customers.
        </p>
      </section>

      {/* LIMITED OFFER */}
      <section className="bg-gray-100 py-12 px-6 text-center">
        <h2 className="text-2xl font-semibold mb-4">🎉 Limited Beta Launch Offer</h2>
        <ul className="text-lg space-y-2 mb-6">
          <li>✅ $20/month — locked in for life</li>
          <li>⏱ Only 100 spots available</li>
          <li>💳 Includes AI Review Analyzer + Dashboard access</li>
          <li>🔒 No contracts. Cancel anytime.</li>
        </ul>

        {/* Charter CTA (requires PRICE_ID_CHARTER on server) */}
        <button
          onClick={() => startCheckout('charter')}
          className="bg-black text-white px-6 py-3 rounded-xl text-lg hover:bg-gray-800 transition"
          disabled={loadingPlan !== null}
        >
          {loadingPlan === 'charter' ? 'Loading…' : '👉 Join the Beta – Lock in $20/month'}
        </button>

        {!user && (
          <div className="mt-3 text-sm text-gray-600">
            New here? <a className="underline" href="/signup">Create an account</a> • Already have one?{' '}
            <a className="underline" href="/login">Log in</a>
          </div>
        )}
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

      {/* PLAN SELECTOR */}
      <section className="bg-gray-50 py-12 px-6 text-center">
        <h4 className="text-xl font-semibold mb-4">Choose your plan</h4>
        <div className="flex flex-wrap gap-3 justify-center">
          <PlanButton plan="starter" loadingPlan={loadingPlan} onClick={startCheckout} />
          <PlanButton plan="pro" loadingPlan={loadingPlan} onClick={startCheckout} />
          <PlanButton plan="business" loadingPlan={loadingPlan} onClick={startCheckout} />
          <PlanButton plan="agency" loadingPlan={loadingPlan} onClick={startCheckout} />
        </div>
        {!user && (
          <p className="mt-3 text-sm text-gray-600">
            You’ll be asked to <a className="underline" href="/login">log in</a> first.
          </p>
        )}
      </section>

      {/* FINAL CTA */}
      <section className="bg-black text-white py-12 px-6 text-center">
        <h2 className="text-2xl font-bold mb-4">👉 Get Instant Insights – Lock in Your Lifetime Price</h2>
        <button
          onClick={() => startCheckout('charter')}
          className="mt-4 bg-white text-black px-6 py-3 rounded-xl text-lg hover:bg-gray-200 transition"
          disabled={loadingPlan !== null}
        >
          {loadingPlan === 'charter' ? 'Redirecting…' : 'Join Now for $20/month'}
        </button>
      </section>
    </main>
  );
}

function PlanButton({
  plan,
  loadingPlan,
  onClick,
}: {
  plan: Plan;
  loadingPlan: Plan | null;
  onClick: (p: Plan) => void;
}) {
  const labelMap: Record<Plan, string> = {
    charter: 'Charter',
    starter: 'Starter',
    pro: 'Pro',
    business: 'Business',
    agency: 'Agency',
  };
  return (
    <button
      onClick={() => onClick(plan)}
      className="px-5 py-2 rounded-xl border hover:bg-gray-100"
      disabled={loadingPlan !== null}
    >
      {loadingPlan === plan ? 'Loading…' : labelMap[plan]}
    </button>
  );
}
