// File: app/plans/page.tsx
'use client';

const plans = [
  {
    title: 'Charter Member',
    price: '$20/month',
    id: 'charter-member',
    url: 'https://buy.stripe.com/bJe14o3kuciJ58zdHJbwk00',
    features: [
      'Founding Member Access',
      'Exclusive Beta Features',
      'Community Support',
    ],
  },
  {
    title: 'Starter',
    price: '$29/month',
    id: 'starter',
    url: 'https://buy.stripe.com/6oUeVedZ8gyZ9oP5bdbwk01',
    features: [
      'Single Location',
      'Monthly AI Report',
      'Basic Dashboard',
      'Email Support',
    ],
  },
  {
    title: 'Pro',
    price: '$79/month',
    id: 'pro',
    url: 'https://buy.stripe.com/9B64gA8EOdmNdF5dHJbwk02',
    features: [
      'Up to 3 Locations',
      'Weekly AI Reports',
      'Enhanced Dashboard',
      'Priority Support',
    ],
  },
  {
    title: 'Business',
    price: '$199/month',
    id: 'business',
    url: 'https://buy.stripe.com/28E9AU4oybeF44vavxbwk03',
    features: [
      'Up to 10 Locations',
      'Weekly AI Reports + Trends',
      'Team Collaboration',
      'Live Chat Support',
    ],
  },
  {
    title: 'Agency',
    price: '$399/month',
    id: 'agency',
    url: 'https://buy.stripe.com/8x23cwaMWaaB7gHavxbwk04',
    features: [
      'Unlimited Client Locations',
      'Custom Branding',
      'Client Sharing + Reports',
      'Dedicated Account Manager',
    ],
  },
];

export default function PlansPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <section className="px-4 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8">Compare All Plans</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="border rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between bg-gray-50"
            >
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-center">✨ {plan.title}</h2>
                <p className="text-center text-lg mb-4 font-medium text-gray-700">{plan.price}</p>
                <ul className="text-sm space-y-2">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2">✅ <span>{f}</span></li>
                  ))}
                </ul>
              </div>
              <a
                href={plan.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-block w-full bg-black text-white text-center py-2 rounded-xl hover:bg-gray-800"
              >
                Select {plan.title}
              </a>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
