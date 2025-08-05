'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ThankYouPage() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.push('/dashboard'), 5000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div style={{ padding: 32 }}>
      <h1>Thank you for your purchase!</h1>
      <p>Redirecting to your dashboard...</p>
    </div>
  );
}
