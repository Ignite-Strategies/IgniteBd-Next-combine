'use client';

import BillForm from './BillForm';

/**
 * Wraps the bill in a simple container: "Hi {companyName}, please see below for your bill."
 */
export default function BillContainer({ companyName, bill, checkoutUrl }) {
  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <p className="text-gray-700">
        Hi {companyName || 'there'}, please see below for your bill.
      </p>
      <BillForm bill={bill} checkoutUrl={checkoutUrl} />
    </div>
  );
}
