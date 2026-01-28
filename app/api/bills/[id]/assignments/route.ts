import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/bills/[id]/assignments
 *
 * Companies linked to this bill (bills_to_companies for billId).
 * Returns billId, companyId, companyName, status, checkoutUrl. No assignment id.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: billId } = await params;

    const bill = await prisma.bills.findUnique({
      where: { id: billId },
      select: { id: true },
    });
    if (!bill) {
      return NextResponse.json({ success: false, error: 'Bill not found' }, { status: 404 });
    }

    const rows = await prisma.bills_to_companies.findMany({
      where: { billId },
      include: {
        company_hqs: {
          select: { id: true, companyName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const list = rows.map((r) => ({
      billId: r.billId,
      companyId: r.companyId,
      companyName: r.company_hqs.companyName,
      status: r.status,
      checkoutUrl: r.checkoutUrl,
      publicBillUrl: r.publicBillUrl,
      slug: r.slug,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ success: true, companies: list });
  } catch (e) {
    console.error('❌ GET /api/bills/[id]/assignments:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to list companies for bill', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
