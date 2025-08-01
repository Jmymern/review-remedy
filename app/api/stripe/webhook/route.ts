// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string); // ✅ No apiVersion

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await req.headers; // ✅ Await the async headers object
  const sig = headersList.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error('❌ Webhook verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ✅ Handle your Stripe events
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('✅ Checkout complete');
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
