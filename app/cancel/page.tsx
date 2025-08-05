// File: app/cancel/page.tsx
export default function CancelPage() {
  return (
    <main className="min-h-screen bg-white text-black text-center py-20 px-6">
      <h1 className="text-4xl font-bold mb-4">❌ Payment Canceled</h1>
      <p className="text-lg mb-6">
        Looks like your payment didn’t go through. You can try again anytime.
      </p>
      <a href="/pricing" className="inline-block bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800">
        Return to Pricing
      </a>
    </main>
  );
}
