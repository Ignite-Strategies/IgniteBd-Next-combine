'use client';

import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';

/**
 * Public page: user lands here after paying a one-off bill via Stripe Checkout.
 * session_id in query for future verification; we show a clear success message.
 */
export default function BillPaidPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center space-y-6 bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
        <div className="space-y-4">
          <Image
            src="/logo.png"
            alt="Ignite Strategies"
            width={80}
            height={80}
            className="mx-auto h-20 w-20 object-contain"
            priority
          />
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            Payment Successful
          </h1>
          <p className="text-white/90 text-lg leading-relaxed">
            Thank you for your payment! We've received it and your transaction is complete.
          </p>
          <p className="text-white/80 text-sm">
            You can safely close this tab.
          </p>
        </div>
      </div>
    </div>
  );
}
