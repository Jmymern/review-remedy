// app/api/stripe-webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // never cache webhooks

// Initialize Stripe (omit apiVersion to avoid type mismatch across SDK versions)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

/**
 * This webhook verifies the signature using the LIVE secret first.
 * If that fails, it tries the TEST secret (STRIPE_WEBHOOK_SECRET_TEST).
 * This lets you send Test events from the Stripe dashboard without
 * swapping environment variables.
 */
export async function POST(req: Request) {
  try {
    const sig = req.headers.get('stripe-signature') || '';
    if (!sig) {
      return NextResponse.json({ ok: false, error: 'Missing stripe-signature' }, { status: 400 });
    }

    // Read the raw request body (required for signature verification)
    const rawBody = await req.text();

    const liveSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const testSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST;

    let event: Stripe.Event;

    const tryConstruct = (secret?: string) => {
      if (!secret) throw new Error('No secret provided');
      return stripe.webhooks.constructEvent(rawBody, sig, secret);
    };

    // Try LIVE first; on failure, try TEST
    try {
      event = tryConstruct(liveSecret);
    } catch {
      event = tryConstruct(testSecret);
    }

    // ---- Handle events you care about ----
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const plan = session.metadata?.plan ?? null;
        const userRef = session.client_reference_id ?? null; // (optional) your user id you passed
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        console.log('[webhook] checkout.session.completed', {
          plan,
          userRef,
          customerId,
          subscriptionId,
        });

        // TODO (optional): Upsert into your DB (e.g., link customerId/subscriptionId to userRef, store plan)
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`[webhook] ${event.type}`, {
          subscriptionId: sub.id,
          status: sub.status,
          customer: sub.customer,
          current_period_end: sub.current_period_end,
        });

        // TODO (optional): Update subscription status in your DB
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('[webhook] invoice.paid', {
          invoice: invoice.id,
          customer: invoice.customer,
          subscription: invoice.subscription,
          amount_paid: invoice.amount_paid,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn('[webhook] invoice.payment_failed', {
          invoice: invoice.id,
          customer: invoice.customer,
          subscription: invoice.subscription,
        });
        // TODO (optional): notify user / mark past_due in DB
        break;
      }

      default:
        // Safe to log unknown events so we can add handling later
        console.log('[webhook] unhandled event', event.type);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('⚠️  Webhook error:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'Webhook processing error' }, { status: 400 });
  }
}

// (Optional) Simple health check for GET
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/stripe/webhook' });
}
