import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials for dev/testing
const supabase = createClient(
  'https://tyqpgfjbjrcqmrisxvln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cXBnZmpianJjcW1yaXN4dmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjU3NTMsImV4cCI6MjA2Nzk0MTc1M30.izgyrjqeooALMd705IW28WLkDN_pyMbpuOTFr1zuAbk'
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('report_name, top_complaint, top_positive, suggestions, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: null, error: err.message || 'Unknown error' }, { status: 500 });
  }
}
