'use client';

/**
 * Displays bill details (name, description, amount) and a "Pay now" button
 * that redirects to Stripe Checkout.
 */
export default function BillForm({ bill, checkoutUrl }) {
  const amount = bill?.amountCents != null ? (bill.amountCents / 100).toFixed(2) : '0.00';
  const currency = (bill?.currency || 'usd').toUpperCase();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">{bill?.name || 'Bill'}</h2>
      {bill?.description && (
        <p className="mt-2 text-sm text-gray-600">{bill.description}</p>
      )}
      <p className="mt-4 text-2xl font-semibold text-gray-900">
        {currency} {amount}
      </p>
      {checkoutUrl ? (
        <a
          href={checkoutUrl}
          className="mt-6 inline-block rounded-lg bg-red-600 px-6 py-2.5 text-center text-sm font-medium text-white hover:bg-red-700"
        >
          Pay now
        </a>
      ) : (
        <p className="mt-6 text-sm text-amber-600">Payment link is not available.</p>
      )}
    </div>
  );
}
