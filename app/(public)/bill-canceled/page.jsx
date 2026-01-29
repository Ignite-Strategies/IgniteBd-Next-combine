'use client';

import Image from 'next/image';

/**
 * Public page: user lands here after canceling one-off bill payment on Stripe Checkout.
 * Friendly fallback message with red branding
 */
export default function BillCanceledPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center space-y-6 bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
        <Image
          src="/logo.png"
          alt="Ignite Strategies"
          width={80}
          height={80}
          className="mx-auto h-20 w-20 object-contain"
          priority
        />
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-white">
            Not ready yet?
          </h1>
          <p className="text-white/90 text-lg leading-relaxed">
            No worries! You can come back anytime to pay using the link.
          </p>
          <p className="text-white/80 text-sm">
            Your payment link will remain available whenever you're ready.
          </p>
        </div>
      </div>
    </div>
  );
}
