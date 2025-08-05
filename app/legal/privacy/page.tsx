
// File: app/legal/privacy/page.tsx
import Footer from '../../components/Footer';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="mb-4">
          Review Remedy respects your privacy. We collect only the data necessary to deliver our
          services — including account info, usage logs, and payment data (via Stripe).
        </p>
        <p className="mb-4">
          We do not share your data with third parties except when required by law or to complete
          service-related tasks (like payment processing or review scraping).
        </p>
        <p className="mb-4">
          You may request data deletion or account removal at any time.
        </p>
      </div>
      <Footer />
    </main>
  );
}
