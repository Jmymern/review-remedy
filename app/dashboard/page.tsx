'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import ReportForm from '../components/ReportForm';

const supabaseUrl = 'https://tyqpgfjbjrcqmrisxvln.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cXBnZmpianJjcW1yaXN4dmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjU3NTMsImV4cCI6MjA2Nzk0MTc1M30.izgyrjqeooALMd705IW28WLkDN_pyMbpuOTFr1zuAbk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Report = {
  id: string;
  user_id: string;
  report_name: string;
  top_complaint: string;
  top_positive: string;
  suggestions: string;
};

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    const fetchReports = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        return;
      }

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching reports:', error.message);
        return;
      }

      setReports(data as Report[]);
    };

    fetchReports();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome to Your Dashboard</h1>
      <ReportForm />

      <h2 style={{ marginTop: '2rem' }}>Your Past Reports</h2>
      {reports.length === 0 ? (
        <p>No reports found yet.</p>
      ) : (
        <ul>
          {reports.map((report) => (
            <li key={report.id} style={{ marginBottom: '1rem' }}>
              <strong>{report.report_name}</strong><br />
              ❌ Complaint: {report.top_complaint}<br />
              ✅ Positive: {report.top_positive}<br />
              💡 Suggestions: {report.suggestions}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
