// File: app/login/page.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    router.replace('/dashboard'); // AI Analyzer
  }

  async function loginWithGoogle() {
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`, // after OAuth
      },
    });
    if (error) {
      setErr(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-6 text-center">Log In</h1>

        <button
          onClick={loginWithGoogle}
          disabled={loading}
          className="w-full border px-4 py-2 rounded-xl hover:bg-gray-50 mb-4 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <div className="text-center text-xs text-gray-400 mb-4">or</div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 border rounded-xl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-2 border rounded-xl"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded-xl hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          Don&apos;t have an account? <a href="/signup" className="underline">Sign up</a>
        </p>
        <p className="text-center text-sm text-gray-600 mt-2">
          Forgot password? <a href="/Forgot-Password" className="underline">Reset it</a>
        </p>
      </section>
    </main>
  );
}
