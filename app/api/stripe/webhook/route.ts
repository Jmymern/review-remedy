import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// ✅ Initialize Stripe with required API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16',
});

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ✅ Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('✅ Checkout session completed:', event.data.object);
      break;

    case 'customer.subscription.updated':
      console.log('🔄 Subscription updated:', event.data.object);
      break;

    case 'customer.subscription.deleted':
      console.log('❌ Subscription deleted:', event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return new NextResponse('Webhook received', { status: 200 });
}
