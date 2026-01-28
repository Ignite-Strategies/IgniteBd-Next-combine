import { prisma } from '@/lib/prisma';
import BillContainer from '@/components/bill/BillContainer';
import { notFound } from 'next/navigation';

/**
 * Public bill page: /bill/[companySlug]/[part].
 * Dynamic URL: bill/companyname/billname-shortId.
 * Server Component - fetches data server-side, no useEffect, instant load.
 */
export default async function BillBySlugPage({ params }) {
  const { companySlug, part } = await params;

  if (!companySlug?.trim() || !part?.trim()) {
    notFound();
  }

  const slug = `${companySlug.trim()}/${part.trim()}`;

  try {
    // Fetch bill directly from database (server-side, no API call needed)
    const bill = await prisma.bills.findUnique({
      where: { slug },
      include: {
        company_hqs: { select: { id: true, companyName: true } },
      },
    });

    if (!bill) {
      notFound();
    }

    if (bill.status !== 'PENDING') {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm text-center">
            <h1 className="text-xl font-semibold text-gray-900">Bill no longer available</h1>
            <p className="mt-2 text-gray-600">
              This bill is no longer available for payment. Status: {bill.status}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <BillContainer
            companyName={bill.company_hqs?.companyName}
            bill={{
              id: bill.id,
              name: bill.name,
              description: bill.description,
              amountCents: bill.amountCents,
              currency: bill.currency,
            }}
            checkoutUrl={bill.checkoutUrl}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('❌ Error loading bill:', error);
    notFound();
  }
}
