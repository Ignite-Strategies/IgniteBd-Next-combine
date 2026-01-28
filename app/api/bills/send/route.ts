import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createBillCheckoutSession } from '@/lib/stripe/billCheckout';
import { generateBillSlug } from '@/lib/billSlug';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.ignitegrowth.biz');

/**
 * POST /api/bills/send
 *
 * MODULAR: Generate payment URL for an EXISTING bill assignment.
 * Requires that bills_to_companies entry already exists (created via POST /api/bills/assign).
 * Creates Stripe Checkout session and generates public payment URL.
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
    } = body;

    if (!billId || !companyId) {
      return NextResponse.json(
        { success: false, error: 'billId and companyId are required' },
        { status: 400 }
      );
    }

    // Find existing assignment - must exist first!
    const assignment = await prisma.bills_to_companies.findFirst({
      where: { billId, companyId },
      include: {
        bills: true,
        company_hqs: {
          select: { id: true, companyName: true, stripeCustomerId: true },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'Bill must be assigned to company first. Use POST /api/bills/assign to create assignment.' },
        { status: 400 }
      );
    }

    // If payment URL already exists, return it
    if (assignment.publicBillUrl) {
      return NextResponse.json({
        success: true,
        billId: assignment.billId,
        companyId: assignment.companyId,
        companyName: assignment.company_hqs.companyName,
        publicBillUrl: assignment.publicBillUrl,
        checkoutUrl: assignment.checkoutUrl,
        slug: assignment.slug,
        message: 'Payment URL already exists for this assignment.',
      });
    }

    const bill = assignment.bills;
    const company = assignment.company_hqs;

    // Create Stripe Checkout session
    const session = await createBillCheckoutSession({
      bill: {
        id: bill.id,
        name: bill.name,
        description: bill.description,
        amountCents: bill.amountCents,
        currency: bill.currency,
      },
      company: {
        id: company.id,
        companyName: company.companyName,
        stripeCustomerId: company.stripeCustomerId,
      },
      successUrl,
      cancelUrl,
    });

    const checkoutUrl = session.url ?? null;

    // Generate slug and public URL
    const { slug, companySlug, part } = generateBillSlug(
      company.companyName,
      bill.name,
      assignment.id
    );
    const publicBillUrl = `${BASE_URL}/bill/${companySlug}/${part}`;

    // Update existing assignment with payment URL details
    const updated = await prisma.bills_to_companies.update({
      where: { id: assignment.id },
      data: {
        stripeCheckoutSessionId: session.id,
        checkoutUrl,
        slug,
        publicBillUrl,
      },
      include: {
        company_hqs: {
          select: { id: true, companyName: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      billId: updated.billId,
      companyId: updated.companyId,
      companyName: updated.company_hqs.companyName,
      publicBillUrl: updated.publicBillUrl,
      checkoutUrl: updated.checkoutUrl,
      slug: updated.slug,
      message: 'Payment URL generated. Copy URL and share with client (e.g. email, Slack).',
    });
  } catch (e) {
    console.error('❌ POST /api/bills/send:', e);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate payment URL',
        details: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
