import { prisma } from '@/lib/prisma';
import InvoiceBill from '@/components/bill/InvoiceBill';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import BillLoading from './loading';
import { createBillCheckoutSession } from '@/lib/stripe/billCheckout';

const APP_DOMAIN = 'https://app.ignitegrowth.biz';

// IMPORTANT:
// Bills are durable DB objects.
// Stripe Checkout Sessions are ephemeral payment windows.
// We intentionally create a new Checkout Session per page load
// and never store or reuse session IDs.

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
    // CRITICAL: Must include company_hqs relationship to get stripeCustomerId
    const bill = await prisma.bills.findUnique({
      where: { slug },
      include: {
        company_hqs: { 
          select: { 
            id: true, 
            companyName: true,
            stripeCustomerId: true,  // ← REQUIRED for Stripe API call
            companyStreet: true,
            companyCity: true,
            companyState: true,
            companyZip: true,
          } 
        },
      },
    });
    
    // Debug: Verify relationship loaded
    if (bill && bill.companyId && !bill.company_hqs) {
      console.error('[BILL_PAGE] ⚠️ CRITICAL: companyId set but company_hqs relationship is NULL!', {
        billId: bill.id,
        companyId: bill.companyId,
        slug: bill.slug,
      });
    }

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

        // Always create a fresh Stripe Checkout Session on page load
        // Sessions are ephemeral - never stored or reused
        let checkoutUrlByUrl = null;

        // Debug: Log bill state
        console.log('[BILL_PAGE] Bill loaded (by URL):', {
          billId: billByUrl.id,
          companyId: billByUrl.companyId,
          hasCompanyHqs: !!billByUrl.company_hqs,
          companyHqsId: billByUrl.company_hqs?.id,
          companyName: billByUrl.company_hqs?.companyName,
          stripeCustomerId: billByUrl.company_hqs?.stripeCustomerId,
        });

        if (billByUrl.company_hqs && billByUrl.companyId) {
          try {
            console.log('[BILL_PAGE] Creating Stripe checkout session...');
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
            console.log('[BILL_PAGE] ✅ Stripe session created:', {
              sessionId: session.id,
              hasUrl: !!checkoutUrlByUrl,
              url: checkoutUrlByUrl?.substring(0, 50) + '...',
            });
            
            if (!checkoutUrlByUrl) {
              console.error('❌ Stripe session created but URL is null:', session.id);
            }
          } catch (error) {
            console.error('❌ Error creating checkout session:', error);
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
            console.error('   Bill ID:', billByUrl.id);
            console.error('   Company ID:', billByUrl.companyId);
            console.error('   Company Name:', billByUrl.company_hqs?.companyName);
            console.error('   Stripe Customer ID:', billByUrl.company_hqs?.stripeCustomerId);
          }
        } else {
          console.warn('⚠️ Cannot create checkout session - missing company_hqs or companyId:', {
            hasCompanyHqs: !!billByUrl.company_hqs,
            companyId: billByUrl.companyId,
            billId: billByUrl.id,
          });
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
              checkoutUrl={checkoutUrlByUrl}
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

    // Always create a fresh Stripe Checkout Session on page load
    // Sessions are ephemeral - never stored or reused
    let checkoutUrl = null;

    // Debug: Log bill state
    console.log('[BILL_PAGE] Bill loaded:', {
      billId: bill.id,
      companyId: bill.companyId,
      hasCompanyHqs: !!bill.company_hqs,
      companyHqsId: bill.company_hqs?.id,
      companyName: bill.company_hqs?.companyName,
      stripeCustomerId: bill.company_hqs?.stripeCustomerId,
    });
    
    // CRITICAL CHECK: Verify companyId matches company_hqs.id
    if (bill.companyId && bill.company_hqs) {
      const idsMatch = bill.companyId === bill.company_hqs.id;
      console.log('[BILL_PAGE] Company ID match check:', {
        billCompanyId: bill.companyId,
        companyHqsId: bill.company_hqs.id,
        idsMatch,
      });
      if (!idsMatch) {
        console.error('[BILL_PAGE] ⚠️ MISMATCH: bill.companyId does not match company_hqs.id!', {
          billCompanyId: bill.companyId,
          companyHqsId: bill.company_hqs.id,
        });
      }
    } else if (bill.companyId && !bill.company_hqs) {
      console.error('[BILL_PAGE] ⚠️ CRITICAL: bill.companyId is set but company_hqs relationship is NULL!', {
        billId: bill.id,
        billCompanyId: bill.companyId,
        expectedCompanyId: '24beffe1-6ada-4442-b90b-7e3ad8a2ec7d', // From user's company record
        doesItMatch: bill.companyId === '24beffe1-6ada-4442-b90b-7e3ad8a2ec7d',
      });
    }

    if (bill.company_hqs && bill.companyId) {
      try {
        console.log('[BILL_PAGE] Creating Stripe checkout session...');
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
        console.log('[BILL_PAGE] ✅ Stripe session created:', {
          sessionId: session.id,
          hasUrl: !!checkoutUrl,
          url: checkoutUrl?.substring(0, 50) + '...',
        });
        
        if (!checkoutUrl) {
          console.error('❌ Stripe session created but URL is null:', session.id);
        }
      } catch (error) {
        console.error('❌ Error creating checkout session:', error);
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);
        console.error('   Bill ID:', bill.id);
        console.error('   Company ID:', bill.companyId);
        console.error('   Company Name:', bill.company_hqs?.companyName);
        console.error('   Stripe Customer ID:', bill.company_hqs?.stripeCustomerId);
        // If session creation fails, we can't show payment button
        // But we still show the bill details
      }
    } else {
      console.warn('⚠️ Cannot create checkout session - missing company_hqs or companyId:', {
        hasCompanyHqs: !!bill.company_hqs,
        companyId: bill.companyId,
        billId: bill.id,
      });
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
          checkoutUrl={checkoutUrl}
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
