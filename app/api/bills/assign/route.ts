import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createBillCheckoutSession } from '@/lib/stripe/billCheckout';
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer';
import { generateBillSlug } from '@/lib/billSlug';

// Payment URLs always use app.ignitegrowth.biz (public-facing app, not platform manager)
const BASE_URL = 'https://app.ignitegrowth.biz';

/**
 * POST /api/bills/assign
 *
 * MANY-TO-ONE: Assign company to bill → sets bill.companyId AND generates payment URL.
 * One atomic operation: set companyId + generate URL.
 *
 * Body: { billId, companyId, successUrl?, cancelUrl? }
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      billId,
      companyId,
      successUrl = `${BASE_URL}/bill-paid`,
      cancelUrl = `${BASE_URL}/bill-canceled`,
    } = body ?? {};

    if (!billId || !companyId) {
      return NextResponse.json(
        { success: false, error: 'billId and companyId are required' },
        { status: 400 }
      );
    }

    // Check if bill already has a company assigned
    const existingBill = await prisma.bills.findUnique({
      where: { id: billId },
      include: {
        company_hqs: {
          select: { id: true, companyName: true },
        },
      },
    });

    if (!existingBill) {
      return NextResponse.json({ success: false, error: 'Bill not found' }, { status: 404 });
    }

    // If bill already assigned to this company, return existing
    if (existingBill.companyId === companyId && existingBill.publicBillUrl) {
      return NextResponse.json({
        success: true,
        billId: existingBill.id,
        companyId: existingBill.companyId,
        companyName: existingBill.company_hqs?.companyName,
        status: existingBill.status,
        publicBillUrl: existingBill.publicBillUrl,
        checkoutUrl: existingBill.checkoutUrl,
        slug: existingBill.slug,
        createdAt: existingBill.createdAt,
        message: 'Bill already assigned. Payment URL available.',
      });
    }

    // If bill assigned to different company, return error
    if (existingBill.companyId && existingBill.companyId !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Bill is already assigned to a different company' },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await prisma.company_hqs.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true, stripeCustomerId: true },
    });

    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    // PRE-MUTATION VALIDATION: Ensure company has Stripe customer ID (create if missing)
    // This happens BEFORE the bill assignment mutation - validates billing capability
    console.log(`[ASSIGN] Validating Stripe customer for company ${companyId}...`);
    const stripeCustomerId = await getOrCreateStripeCustomer(company);
    
    if (!stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'Failed to create Stripe customer for company' },
        { status: 500 }
      );
    }
    
    console.log(`[ASSIGN] ✅ Stripe customer validated: ${stripeCustomerId}`);

    // Refresh company data to get updated stripeCustomerId if it was just created
    const companyWithStripe = await prisma.company_hqs.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true, stripeCustomerId: true },
    });

    if (!companyWithStripe || !companyWithStripe.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'Company Stripe customer validation failed' },
        { status: 500 }
      );
    }

    // NOW create Stripe Checkout session (after validation)
    const session = await createBillCheckoutSession({
      bill: {
        id: existingBill.id,
        name: existingBill.name,
        description: existingBill.description,
        amountCents: existingBill.amountCents,
        currency: existingBill.currency,
      },
      company: {
        id: companyWithStripe.id,
        companyName: companyWithStripe.companyName,
        stripeCustomerId: companyWithStripe.stripeCustomerId,
      },
      successUrl,
      cancelUrl,
    });

    const checkoutUrl = session.url ?? null;

    // Generate slug and public URL (use bill.id instead of assignment.id)
    const { slug, companySlug, part } = generateBillSlug(
      company.companyName,
      existingBill.name,
      existingBill.id
    );
    const publicBillUrl = `${BASE_URL}/bill/${companySlug}/${part}`;

    // UPDATE BILL DIRECTLY - SET companyId AND URL FIELDS
    console.log(`[ASSIGN] Updating bill: billId=${billId}, companyId=${companyId}`);
    const updated = await prisma.bills.update({
      where: { id: billId },
      data: {
        companyId,
        stripeCheckoutSessionId: session.id,
        checkoutUrl,
        status: 'PENDING',
        slug,
        publicBillUrl,
      },
      include: {
        company_hqs: {
          select: { id: true, companyName: true },
        },
      },
    });
    console.log(`[ASSIGN] ✅ Bill updated: companyId=${updated.companyId}, publicBillUrl=${updated.publicBillUrl}`);

    // Return the updated bill with URL
    return NextResponse.json({
      success: true,
      billId: updated.id,
      companyId: updated.companyId,
      companyName: updated.company_hqs?.companyName,
      status: updated.status,
      publicBillUrl: updated.publicBillUrl,
      checkoutUrl: updated.checkoutUrl,
      slug: updated.slug,
      createdAt: updated.createdAt,
      message: 'Bill assigned and payment URL generated.',
    });
  } catch (e) {
    console.error('❌ POST /api/bills/assign:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to assign company to bill', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
