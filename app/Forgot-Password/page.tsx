// File: app/Forgot-Password/page.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`, // why: keep user in app after resetting
    });

    if (error) setError(error.message);
    else setStatus('Check your email for a password reset link.');
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-6 text-center">Forgot Password</h1>
        <form onSubmit={handleReset} className="space-y-4">
          <input
            type="email"
            placeholder="Your account email"
            className="w-full px-4 py-2 border rounded-xl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {status && <p className="text-green-700 text-sm">{status}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded-xl hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-4">
          Remembered it? <a href="/login" className="underline">Back to Login</a>
        </p>
      </section>
    </main>
  );
}
