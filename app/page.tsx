// File: app/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black">
      {/* Hero Section */}
      <section className="w-full px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          Turn Customer Feedback into Growth
        </h1>
        <p className="text-xl max-w-2xl mx-auto text-gray-600 mb-10">
          Our Review Puller gathers your recent customer reviews, and our AI converts them into clear, actionable insights.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/signup">
            <button className="bg-black text-white text-lg px-6 py-3 rounded-xl hover:bg-gray-800">
              Get Started
            </button>
          </Link>
          <Link href="/plans">
            <button className="border border-black text-black text-lg px-6 py-3 rounded-xl hover:bg-gray-100">
              See All Pricing Plans
            </button>
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="w-full px-4 py-16 bg-gray-100 text-center">
        <h2 className="text-4xl font-bold mb-8">How It Works</h2>
        <div className="max-w-3xl mx-auto text-lg text-gray-700 space-y-6">
          <p>1. Sign up for a plan to unlock your AI Analyzer.</p>
          <p>2. Use our Review Puller to gather customer reviews from the last 1, 30, 60, 90, or 365 days.</p>
          <p>3. Our AI detects the top 5 positive and top 5 negative recurring patterns in your reviews.</p>
          <p>4. Receive a focused action plan to double down on what works and avoid what causes negative feedback.</p>
        </div>
        <div className="mt-10">
          <Link href="/signup">
            <button className="bg-black text-white text-lg px-8 py-4 rounded-xl hover:bg-gray-800">
              Start Now
            </button>
          </Link>
        </div>
      </section>

      {/* Trusted By */}
      <section className="w-full px-4 py-16 text-center">
        <h2 className="text-4xl font-bold mb-4">Trusted by Local Businesses</h2>
        <div className="flex justify-center items-center gap-8 mt-6">
          <Image src="/img/logo1.png" alt="Logo 1" width={100} height={50} />
          <Image src="/img/logo2.png" alt="Logo 2" width={100} height={50} />
          <Image src="/img/logo3.png" alt="Logo 3" width={100} height={50} />
        </div>
      </section>
    </main>
  );
}
