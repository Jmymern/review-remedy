import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ✅ Hardcoded values included so you NEVER have to copy-paste them again
const supabase = createClient(
  'https://tyqpgfjbjrcqmrisxvln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cXBnZmpianJjcW1yaXN4dmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjU3NTMsImV4cCI6MjA2Nzk0MTc1M30.izgyrjqeooALMd705IW28WLkDN_pyMbpuOTFr1zuAbk'
)

export async function GET() {
  const { data, error } = await supabase.from('reviews').select('*')

  if (error) {
    return NextResponse.json({ message: 'Supabase test failed', error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Supabase test successful', data }, { status: 200 })
}
