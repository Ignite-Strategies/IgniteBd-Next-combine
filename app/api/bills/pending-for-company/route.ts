import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/bills/pending-for-company?companyId=xxx
 *
 * MANY-TO-ONE: List pending bills for this company (bills.companyId = companyId).
 * Returns PENDING bills with publicBillUrl - checkout sessions are created on-demand when loading bill page.
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

    // Note: checkoutUrl is not stored - sessions are created on-demand when loading bill page
    const items = pending
      .filter((b) => b.publicBillUrl) // Only return bills that have been assigned (have publicBillUrl)
      .map((b) => ({
        billId: b.id,
        billName: b.name,
        description: b.description,
        amountCents: b.amountCents,
        currency: b.currency,
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
