'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ThankYou() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard'); // automatically redirect after 2 seconds
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div>
      <h1>Thanks for joining Review Remedy!</h1>
      <p>We’ve activated your account. You can start running reports now.</p>
      <a href="/dashboard">Go to Dashboard →</a>
    </div>
  );
}
