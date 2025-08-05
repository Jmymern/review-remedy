// File: app/signup/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function signUp() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert('Error: ' + error.message);
    else alert('Check your email to complete signup.');
    setLoading(false);
  }

  async function signUpWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  }

  return (
    <main className="min-h-screen bg-white text-black flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-center">Create your Review Remedy Account</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border p-3 rounded-xl"
        />
        <button
          onClick={signUp}
          disabled={loading}
          className="w-full bg-black text-white py-3 rounded-xl hover:bg-gray-800"
        >
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>
        <hr className="my-4" />
        <button
          onClick={signUpWithGoogle}
          className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700"
        >
          Sign up with Google
        </button>
        <p className="text-center text-sm">
          Already have an account? <a href="/login" className="underline">Log in</a>
        </p>
      </div>
    </main>
  );
}
