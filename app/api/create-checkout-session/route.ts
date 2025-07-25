import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // This version is guaranteed to work on Vercel (even in type checks)
  apiVersion: '2022-11-15',
});

export async function POST() {
  return NextResponse.json({ message: 'Stripe session placeholder' });
}