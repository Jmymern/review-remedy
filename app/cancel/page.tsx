// File: app/cancel/page.tsx
'use client';

import Header from '../components/Header';
import Link from 'next/link';

export default function CancelPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <Header />
      <section className="flex flex-col items-center justify-center text-center px-6 py-24">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">⚠️ Payment Cancelled</h1>
        <p className="text-lg mb-6 max-w-xl">
          Looks like your checkout was cancelled. You can try again or explore our plans to choose the right fit.
        </p>
        <Link
          href="/plans"
          className="bg-black text-white px-6 py-3 rounded-xl text-lg hover:bg-gray-800 transition"
        >
          View Plans
        </Link>
      </section>
    </main>
  );
}
