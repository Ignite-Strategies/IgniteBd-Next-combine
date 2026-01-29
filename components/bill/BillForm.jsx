'use client';

/**
 * Displays bill details (name, description, amount) and a "Pay now" button
 * that redirects to Stripe Checkout.
 */
export default function BillForm({ bill, checkoutUrl }) {
  const amount = bill?.amountCents != null ? (bill.amountCents / 100).toFixed(2) : '0.00';
  const currency = (bill?.currency || 'usd').toUpperCase();

  return (
    <div className="rounded-xl bg-white/95 backdrop-blur-sm p-6 shadow-lg border border-white/30">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{bill?.name || 'Bill'}</h2>
          {bill?.description && (
            <p className="mt-2 text-gray-600">{bill.description}</p>
          )}
        </div>
        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500 uppercase tracking-wide">Amount Due</p>
          <p className="mt-2 text-4xl font-bold text-gray-900">
            {currency} {amount}
          </p>
        </div>
        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            className="mt-6 block w-full rounded-xl bg-gradient-to-r from-red-600 to-orange-600 px-6 py-4 text-center text-lg font-semibold text-white hover:from-red-700 hover:to-orange-700 transition shadow-lg"
          >
            Pay now
          </a>
        ) : (
          <p className="mt-6 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
            Payment link is not available.
          </p>
        )}
      </div>
    </div>
  );
}
