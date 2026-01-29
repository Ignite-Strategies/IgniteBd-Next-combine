import { prisma } from '@/lib/prisma';
import InvoiceBill from '@/components/bill/InvoiceBill';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import BillLoading from './loading';

/**
 * Public bill page for bills subdomain: /[companySlug]/[part]
 * This handles bills.ignitegrowth.biz/company-slug/bill-id directly
 * Server Component - fetches data server-side, no auth, no AppShell, no client-side collision
 * Completely standalone bill container
 */
export default async function RootBillPage({ params }) {
  const { companySlug, part } = await params;

  if (!companySlug?.trim() || !part?.trim()) {
    notFound();
  }

  const slug = `${companySlug.trim()}/${part.trim()}`;

  return (
    <Suspense fallback={<BillLoading />}>
      <BillPageContent companySlug={companySlug} part={part} slug={slug} />
    </Suspense>
  );
}

async function BillPageContent({ companySlug, part, slug }) {
  try {
    // Fetch bill directly from database (server-side, no API call needed)
    const bill = await prisma.bills.findUnique({
      where: { slug },
      include: {
        company_hqs: { 
          select: { 
            id: true, 
            companyName: true,
            companyStreet: true,
            companyCity: true,
            companyState: true,
            companyZip: true,
          } 
        },
      },
    });

    if (!bill) {
      // Log for debugging - check if slug matches
      console.error(`❌ Bill not found for slug: ${slug}`);
      console.error(`   Company slug: ${companySlug}, Part: ${part}`);
      // Try to find by publicBillUrl as fallback (for bills created before slug was set)
      const publicBillUrl = `https://bills.ignitegrowth.biz/${companySlug.trim()}/${part.trim()}`;
      const billByUrl = await prisma.bills.findFirst({
        where: { publicBillUrl },
        include: {
          company_hqs: { 
            select: { 
              id: true, 
              companyName: true,
              companyStreet: true,
              companyCity: true,
              companyState: true,
              companyZip: true,
            } 
          },
        },
      });
      if (billByUrl) {
        console.log(`✅ Found bill by publicBillUrl: ${publicBillUrl}`);
        // Use the found bill
        if (billByUrl.status !== 'PENDING') {
          return (
            <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
              <div className="max-w-md mx-auto text-center space-y-4 bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
                <h1 className="text-2xl font-bold text-white">Bill no longer available</h1>
                <p className="text-white/80">
                  This bill is no longer available for payment. Status: {billByUrl.status}
                </p>
              </div>
            </div>
          );
        }
        return (
          <div className="min-h-screen bg-gray-100 py-12 px-4">
            <InvoiceBill
              bill={{
                id: billByUrl.id,
                name: billByUrl.name,
                description: billByUrl.description,
                amountCents: billByUrl.amountCents,
                currency: billByUrl.currency,
              }}
              checkoutUrl={billByUrl.checkoutUrl}
              companyName={billByUrl.company_hqs?.companyName}
              companyAddress={{
                street: billByUrl.company_hqs?.companyStreet,
                city: billByUrl.company_hqs?.companyCity,
                state: billByUrl.company_hqs?.companyState,
                zip: billByUrl.company_hqs?.companyZip,
              }}
            />
          </div>
        );
      }
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
      <div className="min-h-screen bg-gray-100 py-12 px-4">
        <InvoiceBill
          bill={{
            id: bill.id,
            name: bill.name,
            description: bill.description,
            amountCents: bill.amountCents,
            currency: bill.currency,
          }}
          checkoutUrl={bill.checkoutUrl}
          companyName={bill.company_hqs?.companyName}
          companyAddress={{
            street: bill.company_hqs?.companyStreet,
            city: bill.company_hqs?.companyCity,
            state: bill.company_hqs?.companyState,
            zip: bill.company_hqs?.companyZip,
          }}
        />
      </div>
    );
  } catch (error) {
    console.error('❌ Error loading bill:', error);
    notFound();
  }
}
