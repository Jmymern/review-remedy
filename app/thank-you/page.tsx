'use client'

export default function ThankYouPage() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>🎉 Thank You for Subscribing!</h1>
      <p>Your plan is now active. You can now generate reports directly from your dashboard.</p>
      <a href="/dashboard" style={{ color: 'blue', textDecoration: 'underline' }}>
        → Go to Dashboard
      </a>
    </main>
  );
}
