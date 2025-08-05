// File: app/plans/page.tsx
'use client';

import { useState } from 'react';
import Header from '../components/Header';

const plans = [
  {
    title: 'Starter',
    price: '$29/month',
    id: 'starter',
    features: [
      'Single Location',
      'Monthly AI Report',
      'Basic Dashboard',
      'Email Support',
    ],
  },
  {
    title: 'Pro',
    price: '$49/month',
    id: 'pro',
    features: [
      'Up to 3 Locations',
      'Weekly AI Reports',
      'Enhanced Dashboard',
      'Priority Support',
    ],
  },
  {
    title: 'Business',
    price: '$99/month',
    id: 'business',
    features: [
      'Up to 10 Locations',
      'Weekly AI Reports + Trends',
      'Team Collaboration',
      'Live Chat Support',
    ],
  },
  {
    title: 'Agency',
    price: '$199/month',
    id: 'agency',
    features: [
      'Unlimited Client Locations',
      'Custom Branding',
      'Client Sharing + Reports',
      'Dedicated Account Manager',
    ],
  },
];

export default function PlansOverviewPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function startCheckout(planId: string) {
    setLoadingPlan(planId);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        console.error('Checkout failed response:', data);
        alert('Checkout failed.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Something went wrong. Try again.');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <Header />

      <section className="px-4 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8">Compare All Plans</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="border rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between bg-gray-50"
            >
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-center">✨ {plan.title}</h2>
                <p className="text-center text-lg mb-4 font-medium text-gray-700">{plan.price}</p>
                <ul className="text-sm space-y-2">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2">✅ <span>{f}</span></li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => startCheckout(plan.id)}
                className="mt-6 inline-block w-full bg-black text-white text-center py-2 rounded-xl hover:bg-gray-800"
                disabled={loadingPlan === plan.id}
              >
                {loadingPlan === plan.id ? 'Processing…' : `Select ${plan.title}`}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
