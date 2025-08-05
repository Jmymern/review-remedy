'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const user = useUser();
  const router = useRouter();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setError(null);
    setAiSummary(null);

    if (!user) {
      setError('You must be logged in.');
      return;
    }

    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        body: JSON.stringify({ user_id: user.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }

      if (!data.url) {
        setError('Missing Google Maps URL.');
        return;
      }

      if (!data.reviews || data.reviews.length === 0) {
        setError('No reviews found.');
        return;
      }

      if (!data.summary) {
        setError('AI summarization failed.');
        return;
      }

      setAiSummary(data.summary);
      setReviews(data.reviews);
    } catch (err: any) {
      setError('Unexpected error: ' + err.message);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Welcome to Your Dashboard</h1>

      <div className="mb-4">
        <p className="mb-2">Create AI Summary Report</p>
        <button
          onClick={fetchSummary}
          className="bg-black text-white px-4 py-2 rounded hover:opacity-90"
        >
          Generate Report
        </button>
      </div>

      {error && (
        <div className="text-red-600 font-medium mt-4">
          ❌ Failed: {error}
        </div>
      )}

      {aiSummary && (
        <div className="mt-6 p-4 border rounded bg-gray-50">
          <h2 className="text-xl font-semibold mb-2">AI Summary:</h2>
          <p>{aiSummary}</p>
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-lg font-semibold">Your Past Reports</h2>
        <p className="text-sm text-gray-500">No reports found yet</p>
      </div>
    </div>
  );
}
