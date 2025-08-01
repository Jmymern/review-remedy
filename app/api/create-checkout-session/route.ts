// app/api/create-checkout-session/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Map your plan names to LIVE Price IDs (matches your Vercel env names)
const PRICE_BY_PLAN: Record<string, string | undefined> = {
  starter: process.env.PRICE_ID_STARTER,
  pro: process.env.PRICE_ID_PRO,
  business: process.env.PRICE_ID_BUSINESS,
  agency: process.env.PRICE_ID_AGENCY,
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const plan: string = (body?.plan || 'starter').toLowerCase();
    const userId: string | null = body?.userId ?? null;

    const price = PRICE_BY_PLAN[plan];
    if (!price) {
      return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: 'https://review-remedy.com/dashboard?status=success',
      cancel_url: 'https://review-remedy.com/dashboard?status=cancel',
      // These two values help your webhook know what the user bought
      metadata: { plan },
      client_reference_id: userId || undefined,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('create-checkout-session error:', err?.message || err);
    return NextResponse.json(
      { error: 'Unable to create session' },
      { status: 500 }
    );
  }
}
