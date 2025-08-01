// app/api/stripe/webhook/route.ts
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string); // ✅ No apiVersion here

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = headers().get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed.', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ✅ Handle the event types you care about
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('✅ Checkout session completed');
      break;
    case 'customer.subscription.updated':
      console.log('🔁 Subscription updated');
      break;
    case 'customer.subscription.deleted':
      console.log('🗑️ Subscription deleted');
      break;
    case 'invoice.payment_succeeded':
      console.log('💰 Payment succeeded');
      break;
    case 'invoice.payment_failed':
      console.log('❌ Payment failed');
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
