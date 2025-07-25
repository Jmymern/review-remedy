import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basel', // ✅ The version Vercel expects
});

export async function POST() {
  // Your checkout session logic here...
  return NextResponse.json({ message: 'Stripe session placeholder' });
}
