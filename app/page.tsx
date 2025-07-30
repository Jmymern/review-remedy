'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tyqpgfjbjrcqmrisxvln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cXBnZmpianJjcW1yaXN4dmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjU3NTMsImV4cCI6MjA2Nzk0MTc1M30.izgyrjqeooALMd705IW28WLkDN_pyMbpuOTFr1zuAbk'
);

import Link from 'next/link';

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  const handleCheckout = async () => {
    try {
      if (!user) {
        alert('Please log in before purchasing.');
        window.location.href = '/auth';
        return;
      }

      setLoading(true);
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
      });

      const data = await res.json();

      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert('Something went wrong. No checkout URL returned.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-black font-sans">
      <section className="flex flex-col items-center justify-center text-center py-20 px-6">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          “Your Reviews Are Talking — Are You Listening?”
        </h1>
        <p className="text-lg max-w-2xl">
          AI reads your Google Reviews, finds patterns in praise and complaints, and gives you a clear plan to grow faster and fix what’s costing you customers.
        </p>
      </section>

      <section className="bg-gray-100 py-12 px-6 text-center">
        <h2 className="text-2xl font-semibold mb-4">🎉 Limited Beta Launch Offer</h2>
        <ul className="text-lg space-y-2 mb-6">
          <li>✅ $20/month — locked in for life</li>
          <li>⏱ Only 100 spots available</li>
          <li>💳 Includes AI Review Analyzer + Dashboard access</li>
          <li>🔒 No contracts. Cancel anytime.</li>
        </ul>
        <button
          onClick={handleCheckout}
          className="bg-black text-white px-6 py-3 rounded-xl text-lg hover:bg-gray-800 transition"
          disabled={loading}
        >
          {loading ? 'Loading...' : '👉 Join the Beta – Lock in $20/month'}
        </button>
      </section>

      <section className="py-16 px-6 max-w-4xl mx-auto text-left">
        <h3 className="text-2xl font-semibold mb-6 text-center">📊 Why Review Remedy?</h3>
        <ul className="space-y-4 text-lg">
          <li>🧠 <strong>AI-Powered Review Analysis</strong> — Summarizes your top 5 good + top 5 bad Google reviews.</li>
          <li>📈 <strong>Clear Action Plan</strong> — Know exactly what to improve and what to double down on.</li>
          <li>🔎 <strong>Track What Matters</strong> — Use your dashboard to monitor trends in customer experience.</li>
          <li>🏆 <strong>Stay Ahead</strong> — Fix reputation issues before they cost you real business.</li>
        </ul>
      </section>

      <section className="bg-gray-50 py-12 px-6 text-center">
        <h4 className="text-xl font-semibold mb-4">📢 The Proof Is Real</h4>
        <p className="max-w-2xl mx-auto text-lg mb-6">
          91% of consumers read online reviews before choosing a business<br />
          85% trust them as much as personal recommendations<br />
          33% of customers who leave bad reviews say no one ever followed up<br />
          Businesses that respond to reviews earn up to 20% more revenue<br />
          <em>(Sources: SuperAGI, SmallBusinessExpo, Zendesk 2024)</em>
        </p>
        <blockquote className="text-gray-600 italic">“Within a week of using Review Remedy, I knew exactly why we were losing repeat customers. It’s like having a marketing coach in your pocket.”<br /><span className="not-italic font-semibold">– Early Beta User, Tulsa OK</span></blockquote>
      </section>

      <section className="bg-black text-white py-12 px-6 text-center">
        <h2 className="text-2xl font-bold mb-4">👉 Get Instant Insights – Lock in Your Lifetime Price</h2>
        <button
          onClick={handleCheckout}
          className="mt-4 bg-white text-black px-6 py-3 rounded-xl text-lg hover:bg-gray-200 transition"
          disabled={loading}
        >
          {loading ? 'Redirecting...' : 'Join Now for $20/month'}
        </button>
      </section>
    </main>
  );
}
