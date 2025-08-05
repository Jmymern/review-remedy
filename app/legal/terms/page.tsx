// File: app/legal/terms/page.tsx
import Footer from '../../components/Footer';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        <p className="mb-4">
          By using Review Remedy, you agree to abide by our policies, respect your users' privacy,
          and only use our platform for its intended purpose: to analyze public reviews and
          provide honest feedback and improvement suggestions.
        </p>
        <p className="mb-4">
          We reserve the right to modify or suspend services, and any violation of our terms may
          result in account termination. Contact support if you need further clarification.
        </p>
      </div>
      <Footer />
    </main>
  );
}
