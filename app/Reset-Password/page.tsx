// File: app/Reset-Password/page.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) setError(error.message);
    else setStatus('Password updated. You can now log in.');
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-white text-black">
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
            minLength={8}
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {status && <p className="text-green-700 text-sm">{status}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded-xl hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-4">
          Back to{' '}
          <a href="/login" className="underline">
            login
          </a>
          .
        </p>
      </section>
    </main>
  );
}
