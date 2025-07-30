import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export async function POST() {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_1Ro1ZiJ7WQb3yVJzHM3BM7gs', // ✅ $20/month product
          quantity: 1,
        },
      ],
      success_url: 'https://review-remedy.com/thank-you?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://review-remedy.com/pricing',
    });

    console.log('✅ Stripe session created:', session);

    if (!session.url) {
      throw new Error('❌ Stripe session created but no session.url returned');
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('🔥 Stripe Error:', error);
    return NextResponse.json(
      { error: 'Stripe session creation failed.', details: String(error) },
      { status: 500 }
    );
  }
}
