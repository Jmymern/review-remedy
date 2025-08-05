// File: app/signup/page.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Footer from '../components/Footer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard');
    }
  };

  const handleGoogleSignup = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) {
      setError(error.message);
    }
  };

  return (
    <main className="min-h-screen bg-white text-black flex flex-col justify-between">
      <div>
        <Header />
        <section className="max-w-md mx-auto px-6 py-16">
          <h1 className="text-3xl font-bold mb-6 text-center">Create Account</h1>
          <form onSubmit={handleSignup} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="w-full px-4 py-2 border rounded-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full px-4 py-2 border rounded-xl"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-black text-white py-2 rounded-xl hover:bg-gray-800"
            >
              Sign Up
            </button>
          </form>

          <div className="my-4 text-center text-sm text-gray-500">or</div>

          <button
            onClick={handleGoogleSignup}
            className="w-full bg-red-600 text-white py-2 rounded-xl hover:bg-red-700"
          >
            Sign Up with Google
          </button>

          <p className="text-center text-sm text-gray-600 mt-4">
            Already have an account? <a href="/login" className="underline">Log in</a>
          </p>
        </section>
      </div>
      <Footer />
    </main>
  );
}
