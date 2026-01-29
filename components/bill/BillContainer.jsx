'use client';

import Image from 'next/image';
import BillForm from './BillForm';

/**
 * Wraps the bill in a branded container with logo and greeting.
 */
export default function BillContainer({ companyName, bill, checkoutUrl }) {
  return (
    <div className="max-w-lg mx-auto space-y-6 bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
      <div className="text-center space-y-4">
        <Image
          src="/logo.png"
          alt="Ignite Strategies"
          width={80}
          height={80}
          className="mx-auto h-20 w-20 object-contain"
          priority
        />
        <h1 className="text-2xl font-bold text-white">
          Hi {companyName || 'there'}
        </h1>
        <p className="text-white/90 text-lg">
          Please see below for your bill.
        </p>
      </div>
      <BillForm bill={bill} checkoutUrl={checkoutUrl} />
    </div>
  );
}
