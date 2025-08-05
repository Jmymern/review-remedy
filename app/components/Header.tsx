// File: app/components/Header.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient, User } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Header() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error) setUser(data.user);
    };
    getUser();
  }, []);

  return (
    <header className="w-full bg-white border-b px-6 py-4 flex items-center justify-between">
      <Link href="/" className="text-xl font-bold">
        <span className="text-black">Review Remedy</span>
      </Link>

      <nav className="flex items-center gap-4 text-sm sm:text-base">
        <Link href="/plans" className="hover:underline">Directory</Link>
        <Link href="/pricing" className="hover:underline">Pricing</Link>
        {user ? (
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        ) : (
          <>
            <Link href="/login" className="hover:underline">Login</Link>
            <Link href="/signup" className="hover:underline">Sign Up</Link>
          </>
        )}
      </nav>
    </header>
  );
}
