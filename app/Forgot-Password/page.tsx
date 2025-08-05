// File: app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Header from '../components/Header';
import Footer from '../components/Footer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus('✅ Password reset link sent! Check your email.');
    }
  };

  return (
    <main className="min-h-screen bg-white text-black">
      <Header />
      <section className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-6 text-center">Forgot Password</h1>
        <form onSubmit={handleReset} className="space-y-4">
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full px-4 py-2 border rounded-xl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-black text-white py-2 rounded-xl hover:bg-gray-800"
          >
            Send Reset Link
          </button>
          {status && <p className="text-sm mt-2 text-center">{status}</p>}
        </form>
      </section>
      <Footer />
    </main>
  );
}
