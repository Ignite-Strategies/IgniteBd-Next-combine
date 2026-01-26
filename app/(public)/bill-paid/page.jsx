'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

/**
 * Public page: user lands here after paying a one-off bill via Stripe Checkout.
 * MVP1: simple thank-you. session_id in query if we want to verify later.
 */
export default function BillPaidPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Thank you</h1>
        <p className="mt-2 text-gray-600">
          Your payment was successful. You can close this tab or return to the app.
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-block text-sm font-medium text-red-600 hover:text-red-700"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
