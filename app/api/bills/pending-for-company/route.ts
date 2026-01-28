import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/bills/pending-for-company?companyId=xxx
 *
 * MANY-TO-ONE: List pending bills for this company (bills.companyId = companyId).
 * Returns PENDING bills with checkout URLs so user can pay if they lost the email link.
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

    const pending = await prisma.bills.findMany({
      where: { companyId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    const items = pending
      .filter((b) => b.checkoutUrl)
      .map((b) => ({
        billId: b.id,
        billName: b.name,
        description: b.description,
        amountCents: b.amountCents,
        currency: b.currency,
        checkoutUrl: b.checkoutUrl,
        publicBillUrl: b.publicBillUrl,
        createdAt: b.createdAt,
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
