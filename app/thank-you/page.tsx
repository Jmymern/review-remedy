// File: app/thank-you/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ThankYouPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen bg-white text-black flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <h1 className="text-4xl font-bold mb-4">🎉 Thank You for Subscribing!</h1>
        <p className="text-lg mb-6">
          Your payment was successful and your account has been activated.
          You’ll be redirected to your dashboard shortly.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-black text-white px-6 py-2 rounded-xl text-lg hover:bg-gray-800"
        >
          Go to Dashboard Now
        </button>
      </div>
    </main>
  );
}
