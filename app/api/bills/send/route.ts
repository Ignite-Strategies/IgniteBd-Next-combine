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
 * POST /api/bills/send
 *
 * ⚠️ COMMENTED OUT - Assignment now automatically generates payment URL.
 * Use POST /api/bills/assign instead - it creates junction entry AND generates URL.
 *
 * Create one-time Stripe Checkout, store bills_to_companies row, return public URL.
 * Body: { billId, companyId, successUrl?, cancelUrl? } only. Assign = bill → company_hq (junction); no extra models.
 */
export async function POST(request: Request) {
  // COMMENTED OUT - Assignment now handles URL generation automatically
  return NextResponse.json(
    { success: false, error: 'This endpoint is deprecated. Use POST /api/bills/assign instead - it automatically generates the payment URL.' },
    { status: 410 }
  );

  /* COMMENTED OUT CODE BELOW
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

    const row = await prisma.bills_to_companies.create({
      data: {
        billId,
        companyId,
        stripeCheckoutSessionId: session.id,
        checkoutUrl,
        status: 'PENDING',
      },
    });

    const { slug, companySlug, part } = generateBillSlug(
      company.companyName,
      bill.name,
      row.id
    );
    const publicBillUrl = `${BASE_URL}/bill/${companySlug}/${part}`;

    await prisma.bills_to_companies.update({
      where: { id: row.id },
      data: { slug, publicBillUrl },
    });

    return NextResponse.json({
      success: true,
      url: publicBillUrl,
      checkoutUrl: checkoutUrl ?? undefined,
      slug,
      message: publicBillUrl
        ? 'Bill page link created. Copy URL and share with client (e.g. email, Slack). They’ll see the bill and can pay via Stripe.'
        : 'Session created but no URL returned.',
    });
  } catch (e) {
    console.error('❌ POST /api/bills/send:', e);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send bill',
        details: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
  */
}
