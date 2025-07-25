'use client';
import { useEffect, useState } from 'react';

type Review = {
  id?: number;
  reviewer?: string;
  comment?: string;
  rating?: number;
  report_name?: string;
  top_complaint?: string;
  top_positive?: string;
  suggestions?: string;
  created_at?: string;
};

export default function DashboardPage() {
  const [data, setData] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/dashboard-data');
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json.data);
      } catch (err: any) {
        setError(err.message);
      }
    }
    fetchData();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Dashboard</h1>
      <p>Review Data from Supabase:</p>

      {error && (
        <div style={{ color: 'red', marginTop: '1rem' }}>
          Error: {error}
        </div>
      )}

      {!error && data.length === 0 && <p style={{ marginTop: '1rem' }}>No reviews found.</p>}

      {data.length > 0 && (
        <table style={{ marginTop: '1rem', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Report Name</th>
              <th style={thStyle}>Top Complaint</th>
              <th style={thStyle}>Top Positive</th>
              <th style={thStyle}>Suggestions</th>
              <th style={thStyle}>Created At</th>
            </tr>
          </thead>
          <tbody>
            {data.map((review) => (
              <tr
                key={`${review.id ?? Math.random()}-${review.created_at ?? Date.now()}`}
              >
                <td style={tdStyle}>{review.report_name || 'N/A'}</td>
                <td style={tdStyle}>{review.top_complaint || 'N/A'}</td>
                <td style={tdStyle}>{review.top_positive || 'N/A'}</td>
                <td style={tdStyle}>{review.suggestions || 'N/A'}</td>
                <td style={tdStyle}>
                  {review.created_at
                    ? new Date(review.created_at).toLocaleDateString()
                    : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* --- Report Creation Form --- */}
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Create New Report</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch('/api/create-report', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                review_set: 'Example reviews from Google...',
              }),
            });
            const json = await res.json();
            alert(json.message || 'Report created!');
          }}
        >
          <button type="submit" style={{ padding: '0.5rem 1rem' }}>
            Create Report
          </button>
        </form>
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: 'left' as const,
  borderBottom: '2px solid #ccc',
  padding: '8px',
};

const tdStyle = {
  borderBottom: '1px solid #eee',
  padding: '8px',
};
