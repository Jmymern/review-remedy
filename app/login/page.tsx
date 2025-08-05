// File: app/login/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert('Error: ' + error.message);
    else alert('Check your email for login link.');
    setLoading(false);
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  }

  return (
    <main className="min-h-screen bg-white text-black flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-center">Login to Review Remedy</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border p-3 rounded-xl"
        />
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full bg-black text-white py-3 rounded-xl hover:bg-gray-800"
        >
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>
        <hr className="my-4" />
        <button
          onClick={signInWithGoogle}
          className="w-full bg-red-500 text-white py-3 rounded-xl hover:bg-red-600"
        >
          Sign in with Google
        </button>
        <p className="text-center text-sm">
          New here? <a href="/signup" className="underline">Create an account</a>
        </p>
      </div>
    </main>
  );
}