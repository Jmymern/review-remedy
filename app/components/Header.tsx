// File: app/components/Header.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient, type User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error) setUser(data.user ?? null);
    });
  }, []);

  return (
    <header className="py-4 border-b">
      <nav className="max-w-6xl mx-auto px-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">Review Remedy</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/directory" className={pathname === '/directory' ? 'underline' : ''}>Directory</Link>
          <Link href="/plans" className={pathname === '/plans' ? 'underline' : ''}>Pricing</Link>
          {user ? (
            <Link href="/dashboard" className={pathname === '/dashboard' ? 'underline' : ''}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hover:underline">Login</Link>
              <Link href="/signup" className="hover:underline">Sign Up</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
