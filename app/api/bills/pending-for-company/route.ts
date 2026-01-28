import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/bills/pending-for-company?companyId=xxx
 *
 * List pending one-off bills sent to this company (for "in settings" UX).
 * Returns PENDING bills_to_companies with checkout URLs so user can pay if they lost the email link.
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    const pending = await prisma.bills_to_companies.findMany({
      where: { companyId, status: 'PENDING' },
      include: {
        bills: {
          select: { id: true, name: true, description: true, amountCents: true, currency: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = pending
      .filter((s) => s.checkoutUrl)
      .map((s) => ({
        billSendId: s.id,
        billId: s.bills.id,
        billName: s.bills.name,
        description: s.bills.description,
        amountCents: s.bills.amountCents,
        currency: s.bills.currency,
        checkoutUrl: s.checkoutUrl,
        createdAt: s.createdAt,
      }));

    return NextResponse.json({ success: true, pending: items });
  } catch (e) {
    console.error('❌ GET /api/bills/pending-for-company:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending bills' },
      { status: 500 }
    );
  }
}
