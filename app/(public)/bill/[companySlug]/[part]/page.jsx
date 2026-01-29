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
        <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
          <div className="max-w-md mx-auto text-center space-y-4 bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
            <h1 className="text-2xl font-bold text-white">Bill no longer available</h1>
            <p className="text-white/80">
              This bill is no longer available for payment. Status: {bill.status}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
        <div className="mx-auto max-w-2xl w-full">
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
