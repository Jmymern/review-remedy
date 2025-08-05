'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://tyqpgfjbjrcqmrisxvln.supabase.co', 'eyJh...');

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return alert(error.message);
    router.push('/pricing');
  };

  return (
    <form onSubmit={handleSignup} style={{ padding: 32 }}>
      <h1>Sign Up</h1>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
      <button type="submit">Create Account</button>
    </form>
  );
}
