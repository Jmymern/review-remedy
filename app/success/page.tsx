// File: app/success/page.tsx
export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-white text-black text-center py-20 px-6">
      <h1 className="text-4xl font-bold mb-4">🎉 Payment Successful!</h1>
      <p className="text-lg mb-6">
        Thank you for subscribing. Your access is now active.
      </p>
      <a href="/dashboard" className="inline-block bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800">
        Go to Dashboard
      </a>
    </main>
  );
}