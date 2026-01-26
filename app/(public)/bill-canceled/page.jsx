'use client';

import Link from 'next/link';
import { XCircle } from 'lucide-react';

/**
 * Public page: user lands here after canceling one-off bill payment on Stripe Checkout.
 */
export default function BillCanceledPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm text-center">
        <XCircle className="mx-auto h-12 w-12 text-amber-600" />
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Payment canceled</h1>
        <p className="mt-2 text-gray-600">
          You canceled the payment. You can use the link from your email again to pay later, or
          sign in to the app.
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
