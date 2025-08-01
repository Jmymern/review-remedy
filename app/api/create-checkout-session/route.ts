import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

// NOTE: your repo uses stripe@11.x, which expects '2022-11-15'.
// You can also omit apiVersion completely.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2022-11-15',
});

// Map plan -> LIVE Price IDs from your Vercel env
const PRICE_BY_PLAN: Record<string, string> = {
  starter: process.env.PRICE_ID_STARTER as string,   // e.g. price_...
  pro: process.env.PRICE_ID_PRO as string,
  business: process.env.PRICE_ID_BUSINESS as string,
  agency: process.env.PRICE_ID_AGENCY as string,
  // If you created a separate Charter price, add it here and in Vercel:
  // charter: process.env.PRICE_ID_CHARTER as string,
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const plan: string = body.plan ?? 'starter';
    const userId: string | null = body.userId ?? null;

    const price = PRICE_BY_PLAN[plan];
    if (!price) {
      return NextResponse.json({ error: `Unknown plan: ${plan}` }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url:
        'https://review-remedy.com/thank-you?status=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://review-remedy.com/dashboard?status=cancel',
      client_reference_id: userId || undefined,
      metadata: { plan },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('create-checkout-session error:', err?.message);
    return NextResponse.json({ error: 'Unable to create session' }, { status: 500 });
  }
}
