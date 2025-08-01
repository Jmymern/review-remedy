// app/api/stripe-webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// IMPORTANT: Webhooks require Node runtime (not edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// We read the raw text body to verify the signature
async function readRawBody(req: Request): Promise<string> {
  const buf = await req.arrayBuffer();
  const text = Buffer.from(buf).toString('utf8');
  return text;
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    console.error('Missing stripe-signature or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    console.error('⚠️  Webhook signature verification failed.', err?.message);
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Values we sent when creating the session
        const plan = session.metadata?.plan || null;
        const userId = session.client_reference_id || null;
        const customerId = (session.customer as string) || null;

        console.log('✅ checkout.session.completed', { userId, plan, customerId });

        // (Optional) Update your DB so the user gets access immediately.
        // If you have a "profiles" table keyed by user id:
        // await supabase.from('profiles').upsert({
        //   id: userId,
        //   stripe_customer_id: customerId,
        //   plan,
        //   subscription_status: 'active',
        // });

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status; // active, past_due, canceled, etc.
        const customerId = sub.customer as string;
        const priceId =
          (sub.items?.data?.[0]?.price?.id as string | undefined) || null;

        console.log(`ℹ️ ${event.type}`, { customerId, status, priceId });

        // Optional DB update here, mapping customerId -> user
        // await supabase.from('subscriptions').upsert({
        //   stripe_customer_id: customerId,
        //   status,
        //   price_id: priceId,
        //   current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        // });

        break;
      }

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        console.log(`ℹ️ ${event.type}`, {
          customerId: inv.customer,
          amount_due: inv.amount_due,
          paid: inv.paid,
        });
        break;
      }

      default:
        // Not handling other events right now
        console.log('Unhandled event:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook handler error', err?.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
