import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // never cache webhooks

// NOTE: Your repo uses stripe@11.x. Keep this version string.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2022-11-15',
});

// Set this in Vercel: STRIPE_WEBHOOK_SECRET (from Dashboard → Webhooks → your endpoint)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      // Optional metadata we set in create-checkout-session
      const plan = session.metadata?.plan ?? 'starter';
      const userId = session.client_reference_id ?? null;

      // TODO: upsert to your DB (profiles/subscriptions) if you want here.
      // For now we just log so you can see it in Vercel → Runtime Logs.
      console.log('✅ checkout.session.completed', { plan, userId, sessionId: session.id });
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      console.log(`ℹ️ ${event.type}`, {
        subId: sub.id,
        status: sub.status,
        priceId: sub.items.data[0]?.price?.id,
        customer: sub.customer,
      });
      break;
    }

    default:
      console.log(`🔔 Unhandled event type: ${event.type}`);
  }
}

export async function POST(req: Request) {
  try {
    if (!endpointSecret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const sig = req.headers.get('stripe-signature') as string;
    const body = await req.text(); // raw body string is required

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err?.message);
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    await handleEvent(event);
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook handler error:', err?.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
