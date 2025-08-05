'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tyqpgfjbjrcqmrisxvln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cXBnZmpianJjcW1yaXN4dmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjU3NTMsImV4cCI6MjA2Nzk0MTc1M30.izgyrjqeooALMd705IW28WLkDN_pyMbpuOTFr1zuAbk'
);

export default function ReportForm() {
  const [businessUrl, setBusinessUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Replace with actual AI/summary endpoint
    const response = await fetch('/api/create-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: businessUrl })
    });

    const result = await response.json();
    setLoading(false);

    if (response.ok) {
      setMessage('✅ Report generated successfully!');
      setBusinessUrl('');
    } else {
      setMessage(`❌ Failed: ${result.error || 'Something went wrong'}`);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h2>Create AI Summary Report</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="url"
          required
          value={businessUrl}
          onChange={(e) => setBusinessUrl(e.target.value)}
          placeholder="Paste your Google Business Profile URL"
          style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '0.75rem 1.5rem' }}
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </form>
      {loading && <p style={{ marginTop: '1rem' }}>🔄 Summarizing reviews with AI...</p>}
      {message && <p style={{ marginTop: '1rem' }}>{message}</p>}
    </div>
  );
}
