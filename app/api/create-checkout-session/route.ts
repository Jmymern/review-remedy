// File: app/api/create-checkout-session/route.ts

import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST() {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: 'price_1RoEVhR0sArT9xLlXltEsI0P', // ✅ your confirmed Stripe Price ID
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/pricing',
    });

    return NextResponse.json({ id: session.id });
  } catch (err) {
    console.error('Stripe session error:', err);
    return NextResponse.json({ error: 'Checkout session creation failed' }, { status: 500 });
  }
}
