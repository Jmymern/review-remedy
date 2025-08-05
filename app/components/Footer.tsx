// File: app/components/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-100 border-t py-6 px-4 text-sm text-gray-600 mt-20">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <img src="/logo-square.svg" alt="Review Remedy Logo" className="w-6 h-6" />
          <span>© {new Date().getFullYear()} Review Remedy</span>
        </div>
        <div className="flex gap-4">
          <Link href="/legal/terms" className="hover:underline">Terms</Link>
          <Link href="/legal/privacy" className="hover:underline">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
