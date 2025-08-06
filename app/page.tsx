'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Header from './components/Header';

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black">
      <Header />

      <section className="w-full px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          Automate Your Google Reviews
        </h1>
        <p className="text-xl max-w-2xl mx-auto text-gray-600 mb-10">
          Review Remedy helps businesses get more 5-star reviews and stand out on Google.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/signup">
            <Button className="text-lg px-6 py-3">Get Started</Button>
          </Link>
          <Link href="/plans">
            <Button variant="outline" className="text-lg px-6 py-3">See All Pricing Plans</Button>
          </Link>
        </div>
      </section>

      <section className="w-full px-4 py-16 bg-gray-100 text-center">
        <h2 className="text-4xl font-bold mb-4">How It Works</h2>
        <p className="text-lg text-gray-700 max-w-xl mx-auto">
          Send a review link to your customers, they leave 5-star reviews, and your business grows.
        </p>
      </section>

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
