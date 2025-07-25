'use client';

import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe('pk_test_51Rk9leR0sArT9xLl8ZFtIiQ7zwYurluSL43pXZOriK5aooxj0wflAoYCNjzwcyxd32M1V15IcgfTZ9Dm9RE8djMB00ykifb4t6');

export default function PricingPage() {
  const handleCheckout = async () => {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
    });

    const data = await res.json();

    if (data.id) {
      const stripe = await stripePromise;
      stripe?.redirectToCheckout({ sessionId: data.id });
    } else {
      alert('Something went wrong.');
    }
  };

  return (
    <div>
      <h1>Choose Your Plan</h1>
      <div style={{ border: '1px solid gray', padding: '20px', maxWidth: '300px' }}>
        <h2>Pro Plan</h2>
        <p>$20 / month</p>
        <button onClick={handleCheckout}>Buy Now</button>
      </div>
    </div>
  );
}
