// File: app/page.tsx
'use client';

import Link from 'next/link';
import Header from './components/Header';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <Header />

      <section className="py-20 px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-6">Welcome to Review Remedy</h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto mb-8">
          Simplify your review management with AI-powered insights and streamlined tools.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/signup"
            className="bg-black text-white px-6 py-3 rounded-xl text-lg hover:bg-gray-800"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="border border-black px-6 py-3 rounded-xl text-lg hover:bg-gray-100"
          >
            Log In
          </Link>
          <Link
            href="/plans"
            className="border border-black px-6 py-3 rounded-xl text-lg hover:bg-gray-100"
          >
            See All Pricing Plans
          </Link>
        </div>
      </section>
    </main>
  );
}
