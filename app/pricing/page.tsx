'use client';

export default function PricingPage() {
  const handleCheckout = async () => {
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Something went wrong. No checkout URL returned.');
      }
    } catch (err) {
      console.error('Checkout Error:', err);
      alert('Checkout failed. See console for details.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black px-4">
      <h1 className="text-3xl font-bold mb-4">Choose Your Plan</h1>
      <div className="border border-gray-300 rounded-lg p-6 shadow-md max-w-sm text-center">
        <h2 className="text-xl font-semibold mb-2">Pro Plan</h2>
        <p className="mb-4">$20 / month</p>
        <button
          onClick={handleCheckout}
          className="bg-yellow-400 text-black font-bold py-2 px-6 rounded hover:bg-yellow-500 transition"
        >
          Join Now – $20/month
        </button>
      </div>
    </div>
  );
}
