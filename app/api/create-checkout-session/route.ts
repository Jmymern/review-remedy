// app/api/create-checkout-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string); // ← no apiVersion

export async function POST(req: NextRequest) {
  const { plan } = await req.json();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price: process.env[`PRICE_ID_${plan.toUpperCase()}`],
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/thank-you`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing`,
  });

  return NextResponse.json({ url: session.url });
}
