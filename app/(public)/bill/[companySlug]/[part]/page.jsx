import { prisma } from '@/lib/prisma';
import BillContainer from '@/components/bill/BillContainer';
import { notFound } from 'next/navigation';
import { createBillCheckoutSession } from '@/lib/stripe/billCheckout';

const APP_DOMAIN = 'https://app.ignitegrowth.biz';

// IMPORTANT:
// Bills are durable DB objects.
// Stripe Checkout Sessions are ephemeral payment windows.
// We intentionally create a new Checkout Session per page load
// and never store or reuse session IDs.

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
        company_hqs: { 
          select: { 
            id: true, 
            companyName: true,
            stripeCustomerId: true,
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
              stripeCustomerId: true,
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

        // Always create a fresh Stripe Checkout Session on page load
        let checkoutUrlByUrl = null;
        if (billByUrl.company_hqs && billByUrl.companyId) {
          try {
            const session = await createBillCheckoutSession({
              bill: {
                id: billByUrl.id,
                name: billByUrl.name,
                description: billByUrl.description,
                amountCents: billByUrl.amountCents,
                currency: billByUrl.currency,
              },
              company: {
                id: billByUrl.company_hqs.id,
                companyName: billByUrl.company_hqs.companyName,
                stripeCustomerId: billByUrl.company_hqs.stripeCustomerId,
              },
              successUrl: `${APP_DOMAIN}/bill-paid`,
              cancelUrl: `${APP_DOMAIN}/bill-canceled`,
            });
            checkoutUrlByUrl = session.url;
          } catch (error) {
            console.error('❌ Error creating checkout session:', error);
          }
        }

        return (
          <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
            <div className="mx-auto max-w-2xl w-full">
              <BillContainer
                companyName={billByUrl.company_hqs?.companyName}
                bill={{
                  id: billByUrl.id,
                  name: billByUrl.name,
                  description: billByUrl.description,
                  amountCents: billByUrl.amountCents,
                  currency: billByUrl.currency,
                }}
                checkoutUrl={checkoutUrlByUrl}
              />
            </div>
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

    // Always create a fresh Stripe Checkout Session on page load
    let checkoutUrl = null;
    if (bill.company_hqs && bill.companyId) {
      try {
        const session = await createBillCheckoutSession({
          bill: {
            id: bill.id,
            name: bill.name,
            description: bill.description,
            amountCents: bill.amountCents,
            currency: bill.currency,
          },
          company: {
            id: bill.company_hqs.id,
            companyName: bill.company_hqs.companyName,
            stripeCustomerId: bill.company_hqs.stripeCustomerId,
          },
          successUrl: `${APP_DOMAIN}/bill-paid`,
          cancelUrl: `${APP_DOMAIN}/bill-canceled`,
        });
        checkoutUrl = session.url;
      } catch (error) {
        console.error('❌ Error creating checkout session:', error);
      }
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
            checkoutUrl={checkoutUrl}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('❌ Error loading bill:', error);
    notFound();
  }
}
