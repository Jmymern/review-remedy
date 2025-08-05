// File: app/pricing/page.tsx
'use client';

import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  async function handleCheckout(plan: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert('Unable to proceed to checkout.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <Header />

      <section className="px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-6">Choose Your Plan</h1>
        <p className="mb-8 text-gray-700">Flexible pricing for businesses of all sizes.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div className="border rounded-xl p-6 shadow bg-gray-50">
            <h2 className="text-xl font-semibold mb-2">Starter</h2>
            <p className="mb-4">$29/month</p>
            <button
              className="bg-black text-white py-2 px-4 rounded hover:bg-gray-800"
              onClick={() => handleCheckout('starter')}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Select Plan'}
            </button>
          </div>
          <div className="border rounded-xl p-6 shadow bg-gray-50">
            <h2 className="text-xl font-semibold mb-2">Pro</h2>
            <p className="mb-4">$49/month</p>
            <button
              className="bg-black text-white py-2 px-4 rounded hover:bg-gray-800"
              onClick={() => handleCheckout('pro')}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Select Plan'}
            </button>
          </div>
          <div className="border rounded-xl p-6 shadow bg-gray-50">
            <h2 className="text-xl font-semibold mb-2">Business</h2>
            <p className="mb-4">$99/month</p>
            <button
              className="bg-black text-white py-2 px-4 rounded hover:bg-gray-800"
              onClick={() => handleCheckout('business')}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Select Plan'}
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
