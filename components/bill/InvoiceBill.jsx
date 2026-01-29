'use client';

import Image from 'next/image';

/**
 * Professional invoice-style bill display
 * Similar to Stripe/QuickBooks invoices
 */
export default function InvoiceBill({ 
  bill, 
  checkoutUrl, 
  companyName,
  companyAddress,
  fromCompany = {
    name: 'Ignite Strategies LLC',
    address: {
      street: '2604 N. George Mason Dr.',
      city: 'Arlington',
      state: 'VA',
      zip: '22207'
    }
  }
}) {
  const amount = bill?.amountCents != null ? (bill.amountCents / 100).toFixed(2) : '0.00';
  const currency = (bill?.currency || 'usd').toUpperCase();
  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;

  const formatAddress = (addr) => {
    if (!addr) return null;
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.city || addr.state || addr.zip) {
      const cityStateZip = [addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
      if (cityStateZip) parts.push(cityStateZip);
    }
    return parts.length > 0 ? parts.join('\n') : null;
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-2xl overflow-hidden">
      {/* Header with logo and branding */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="Ignite Strategies"
              width={60}
              height={60}
              className="h-12 w-12 object-contain bg-white rounded-lg p-1"
              priority
            />
            <div>
              <h1 className="text-2xl font-bold text-white">{fromCompany.name}</h1>
              <p className="text-red-100 text-sm">Invoice</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="px-8 py-8">
        {/* From/To Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* From */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">From</h2>
            <div className="text-gray-900">
              <p className="font-semibold text-lg">{fromCompany.name}</p>
              {formatAddress(fromCompany.address) && (
                <pre className="mt-2 text-sm text-gray-600 whitespace-pre-wrap font-sans">
                  {formatAddress(fromCompany.address)}
                </pre>
              )}
            </div>
          </div>

          {/* Bill To */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bill To</h2>
            <div className="text-gray-900">
              <p className="font-semibold text-lg">{companyName || 'Company'}</p>
              {formatAddress(companyAddress) && (
                <pre className="mt-2 text-sm text-gray-600 whitespace-pre-wrap font-sans">
                  {formatAddress(companyAddress)}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="border-t border-gray-200 pt-6 mb-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{bill?.name || 'Invoice'}</h3>
            {bill?.description && (
              <p className="text-gray-600 text-sm mt-2">{bill.description}</p>
            )}
          </div>

          {/* Amount Section */}
          <div className="bg-gray-50 rounded-lg p-6 mt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-gray-600">Amount Due</span>
              <span className="text-4xl font-bold text-gray-900">
                {currencySymbol}{amount}
              </span>
            </div>
            {bill?.description && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">For:</span> {bill.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Button */}
        {checkoutUrl ? (
          <div className="mt-8">
            <a
              href={checkoutUrl}
              className="block w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 text-center text-lg font-semibold text-white hover:from-red-700 hover:to-red-800 transition shadow-lg"
            >
              Pay Here
            </a>
            <p className="mt-3 text-center text-xs text-gray-500">
              Secure payment powered by Stripe
            </p>
          </div>
        ) : (
          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 text-center">
              Payment link is not available. Please contact support.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Thank you for your business
        </p>
      </div>
    </div>
  );
}
