// File: app/success/page.tsx
'use client';

import Header from '../components/Header';
import Link from 'next/link';

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <Header />
      <section className="flex flex-col items-center justify-center text-center px-6 py-24">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">🎉 Payment Successful!</h1>
        <p className="text-lg mb-6 max-w-xl">
          Your payment has been processed. You now have access to the Review Remedy dashboard and features.
        </p>
        <Link
          href="/dashboard"
          className="bg-black text-white px-6 py-3 rounded-xl text-lg hover:bg-gray-800 transition"
        >
          Go to Dashboard
        </Link>
      </section>
    </main>
  );
}
