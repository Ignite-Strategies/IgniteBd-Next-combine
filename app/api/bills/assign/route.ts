import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer';
import { generateBillSlug } from '@/lib/billSlug';

// IMPORTANT:
// Bills are durable DB objects.
// Stripe Checkout Sessions are ephemeral payment windows.
// We intentionally create a new Checkout Session per page load
// and never store or reuse session IDs.

// Payment URLs: Use bills subdomain for cleaner URLs, fallback to app domain
const BILLS_DOMAIN = process.env.BILLS_DOMAIN || 'bills.ignitegrowth.biz';
const APP_DOMAIN = 'https://app.ignitegrowth.biz';

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
      successUrl = `${APP_DOMAIN}/bill-paid`,
      cancelUrl = `${APP_DOMAIN}/bill-canceled`,
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

    // If bill already assigned to this company, return success
    // Note: We don't create/store checkout sessions here - they're created on bill page load
    if (existingBill.companyId === companyId && existingBill.publicBillUrl) {
      return NextResponse.json({
        success: true,
        billId: existingBill.id,
        companyId: existingBill.companyId,
        companyName: existingBill.company_hqs?.companyName,
        status: existingBill.status,
        publicBillUrl: existingBill.publicBillUrl,
        slug: existingBill.slug,
        createdAt: existingBill.createdAt,
        message: 'Bill already assigned. Payment URL available at publicBillUrl.',
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

    // Generate slug and public URL (use bill.id instead of assignment.id)
    const { slug, companySlug, part } = generateBillSlug(
      company.companyName,
      existingBill.name,
      existingBill.id
    );
    // Use bills subdomain with cleaner URL format (no /bill/ prefix)
    // Rewrites in next.config.mjs handle routing: bills.ignitegrowth.biz/company-slug/bill-id → /bill/company-slug/bill-id
    const publicBillUrl = `https://${BILLS_DOMAIN}/${companySlug}/${part}`;

    // UPDATE BILL DIRECTLY - SET companyId AND URL FIELDS
    // Note: We do NOT create/store Stripe checkout sessions here - they're created on bill page load
    console.log(`[ASSIGN] Updating bill: billId=${billId}, companyId=${companyId}`);
    const updated = await prisma.bills.update({
      where: { id: billId },
      data: {
        companyId,
        status: 'PENDING',
        slug,
        publicBillUrl,
        // Explicitly clear any old session data - sessions are ephemeral
        stripeCheckoutSessionId: null,
        checkoutUrl: null,
      },
      include: {
        company_hqs: {
          select: { id: true, companyName: true },
        },
      },
    });
    console.log(`[ASSIGN] ✅ Bill updated: companyId=${updated.companyId}, publicBillUrl=${updated.publicBillUrl}`);

    // Return the updated bill with public URL
    // Checkout sessions are created on-demand when the bill page loads
    return NextResponse.json({
      success: true,
      billId: updated.id,
      companyId: updated.companyId,
      companyName: updated.company_hqs?.companyName,
      status: updated.status,
      publicBillUrl: updated.publicBillUrl,
      slug: updated.slug,
      createdAt: updated.createdAt,
      message: 'Bill assigned. Payment URL available at publicBillUrl.',
    });
  } catch (e) {
    console.error('❌ POST /api/bills/assign:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to assign company to bill', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
