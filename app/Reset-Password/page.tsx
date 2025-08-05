// File: app/reset-password/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Footer from '../components/Footer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        setStatus('Invalid or expired reset link.');
      }
    });
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (password !== confirm) {
      setStatus("Passwords don't match");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus('✅ Password updated! Redirecting...');
      setTimeout(() => router.push('/login'), 2000);
    }
  };

  return (
    <main className="min-h-screen bg-white text-black">
      <Header />
      <section className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-6 text-center">Reset Password</h1>
        <form onSubmit={handleUpdate} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            className="w-full px-4 py-2 border rounded-xl"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            className="w-full px-4 py-2 border rounded-xl"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {status && <p className="text-sm text-center">{status}</p>}
          <button
            type="submit"
            className="w-full bg-black text-white py-2 rounded-xl hover:bg-gray-800"
          >
            Update Password
          </button>
        </form>
      </section>
      <Footer />
    </main>
  );
}
