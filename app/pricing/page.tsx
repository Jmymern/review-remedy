'use client';

import { useEffect, useState } from 'react';
import { createClient, type User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  'https://tyqpgfjbjrcqmrisxvln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cXBnZmpianJjcW1yaXN4dmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjU3NTMsImV4cCI6MjA2Nzk0MTc1M30.izgyrjqeooALMd705IW28WLkDN_pyMbpuOTFr1zuAbk'
);

type Plan = 'starter' | 'pro' | 'business' | 'agency';

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error) setUser(data.user ?? null);
    });
  }, []);

  async function startCheckout(plan: Plan) {
    if (!user) {
      alert('Please log in first.');
      router.push('/login');
      return;
    }

    try {
      setLoadingPlan(plan);
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert('Something went wrong.');
      }
    } catch (err) {
      console.error(err);
      alert('Checkout failed.');
    } finally {
      setLoadingPlan(null);
    }
  }

  const plans = [
    {
      key: 'starter',
      title: 'Starter',
      price: '$29/month',
      features: [
        'Basic AI Review Analysis',
        'Limited Dashboard Access',
        'Email Support'
      ]
    },
    {
      key: 'pro',
      title: 'Pro',
      price: '$49/month',
      features: [
        'Full AI Review Summary',
        'Complete Dashboard Access',
        'Priority Email Support'
      ]
    },
    {
      key: 'business',
      title: 'Business',
      price: '$99/month',
      features: [
        'Multi-location Analysis',
        'Team Dashboard Access',
        'Live Chat Support'
      ]
    },
    {
      key: 'agency',
      title: 'Agency',
      price: '$199/month',
      features: [
        'Agency Dashboard + Client Management',
        'API Access',
        'Dedicated Account Manager'
      ]
    },
  ];

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-black">
      <h1 className="text-3xl font-bold text-center mb-10">Choose the Plan That Fits You</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.key}
            className="border rounded-2xl p-6 shadow hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <h2 className="text-xl font-semibold mb-2 text-center">{plan.title}</h2>
              <p className="text-center text-lg mb-4">{plan.price}</p>
              <ul className="mb-6 space-y-2 text-sm">
                {plan.features.map((f, i) => (
                  <li key={i}>✅ {f}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => startCheckout(plan.key as Plan)}
              className="bg-black text-white py-2 rounded-xl mt-auto hover:bg-gray-800"
              disabled={loadingPlan !== null}
            >
              {loadingPlan === plan.key ? 'Processing…' : 'Select Plan'}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
