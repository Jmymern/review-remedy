// File: app/plans/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';


export default function PlansOverviewPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const plans = [
    {
      title: 'Starter',
      price: '$29/mo',
      features: [
        'Single Location',
        'Monthly AI Report',
        'Basic Dashboard',
        'Email Support'
      ]
    },
    {
      title: 'Pro',
      price: '$49/mo',
      features: [
        'Up to 3 Locations',
        'Weekly AI Reports',
        'Enhanced Dashboard',
        'Priority Support'
      ]
    },
    {
      title: 'Business',
      price: '$99/mo',
      features: [
        'Up to 10 Locations',
        'Weekly AI Reports + Trends',
        'Team Collaboration',
        'Live Chat Support'
      ]
    },
    {
      title: 'Agency',
      price: '$199/mo',
      features: [
        'Unlimited Client Locations',
        'Custom Branding',
        'Client Sharing + Reports',
        'Dedicated Account Manager'
      ]
    },
  ];

  return (
    <main className="min-h-screen bg-white text-black">
      {/* HEADER WITH MOBILE NAV */}
      <header className="px-6 py-4 bg-white shadow mb-12 flex justify-between items-center">
        <Link href="/">
          <Image
            src="/review_remedy_logo.png"
            alt="Review Remedy Logo"
            width={160}
            height={50}
            priority
          />
        </Link>
        <button
          className="sm:hidden text-sm border px-3 py-1 rounded"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? '✖ Close' : '☰ Menu'}
        </button>
        <nav className="hidden sm:flex gap-4 text-sm">
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          <Link href="/plans" className="hover:underline">Plans</Link>
          <Link href="/login" className="hover:underline">Login</Link>
          <Link href="/signup" className="hover:underline">Sign Up</Link>
        </nav>
      </header>

      {menuOpen && (
        <nav className="sm:hidden flex flex-col gap-2 px-6 pb-4 text-sm border-b">
          <Link href="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
          <Link href="/plans" onClick={() => setMenuOpen(false)}>Plans</Link>
          <Link href="/login" onClick={() => setMenuOpen(false)}>Login</Link>
          <Link href="/signup" onClick={() => setMenuOpen(false)}>Sign Up</Link>
        </nav>
      )}

      {/* PAGE CONTENT */}
      <section className="px-4 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8">Compare All Plans</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => (
            <div
              key={i}
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
              <a
                href="/pricing"
                className="mt-6 inline-block w-full bg-black text-white text-center py-2 rounded-xl hover:bg-gray-800"
              >
                Choose {plan.title}
              </a>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
