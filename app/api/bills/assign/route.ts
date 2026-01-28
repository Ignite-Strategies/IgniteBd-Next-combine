import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createBillCheckoutSession } from '@/lib/stripe/billCheckout';
import { generateBillSlug } from '@/lib/billSlug';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

/**
 * POST /api/bills/assign
 *
 * Assign a company to a bill → creates bills_to_companies row (junction) AND generates payment URL.
 * This is the single action: assign company → create junction entry → generate URL → return URL.
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

    // Check if assignment already exists
    const existing = await prisma.bills_to_companies.findFirst({
      where: { billId, companyId },
    });

    if (existing) {
      // Return existing assignment with URL if it exists
      return NextResponse.json({
        success: true,
        billId: existing.billId,
        companyId: existing.companyId,
        companyName: (await prisma.company_hqs.findUnique({ where: { id: companyId }, select: { companyName: true } }))?.companyName,
        status: existing.status,
        publicBillUrl: existing.publicBillUrl,
        checkoutUrl: existing.checkoutUrl,
        slug: existing.slug,
        createdAt: existing.createdAt,
        message: existing.publicBillUrl ? 'Bill already assigned. Payment URL available.' : 'Bill already assigned but no payment URL.',
      });
    }

    const [bill, company] = await Promise.all([
      prisma.bills.findUnique({ where: { id: billId } }),
      prisma.company_hqs.findUnique({
        where: { id: companyId },
        select: { id: true, companyName: true, stripeCustomerId: true },
      }),
    ]);

    if (!bill) {
      return NextResponse.json({ success: false, error: 'Bill not found' }, { status: 404 });
    }
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

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

    // Create junction table entry
    const assignment = await prisma.bills_to_companies.create({
      data: {
        billId,
        companyId,
        stripeCheckoutSessionId: session.id,
        checkoutUrl,
        status: 'PENDING',
      },
      include: {
        company_hqs: {
          select: { id: true, companyName: true },
        },
      },
    });

    // Generate slug and public URL
    const { slug, companySlug, part } = generateBillSlug(
      company.companyName,
      bill.name,
      assignment.id
    );
    const publicBillUrl = `${BASE_URL}/bill/${companySlug}/${part}`;

    // Update with slug and public URL
    const updated = await prisma.bills_to_companies.update({
      where: { id: assignment.id },
      data: { slug, publicBillUrl },
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
