import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createBillCheckoutSession } from '@/lib/stripe/billCheckout';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

/**
 * POST /api/bills/send
 *
 * Send bill to company: create one-time Stripe Checkout, store bill_send, return public URL.
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

    const billSend = await prisma.bill_sends.create({
      data: {
        billId,
        companyId,
        stripeCheckoutSessionId: session.id,
        checkoutUrl,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      url: checkoutUrl,
      billSendId: billSend.id,
      message: checkoutUrl
        ? 'Checkout link created. Share the URL with the client to pay.'
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
}
