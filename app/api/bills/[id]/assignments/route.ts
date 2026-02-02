import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/bills/[id]/assignments
 *
 * MANY-TO-ONE: Returns the company assigned to this bill (if any).
 * Since bills now have direct companyId FK, returns single company or empty array.
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
      include: {
        company_hqs: {
          select: { id: true, companyName: true },
        },
      },
    });

    if (!bill) {
      return NextResponse.json({ success: false, error: 'Bill not found' }, { status: 404 });
    }

    // If bill has companyId, return that company
    // Note: checkoutUrl is not returned - sessions are created on-demand when loading bill page
    if (bill.companyId && bill.company_hqs) {
      const company = {
        billId: bill.id,
        companyId: bill.companyId,
        companyName: bill.company_hqs.companyName,
        status: bill.status,
        publicBillUrl: bill.publicBillUrl,
        slug: bill.slug,
        createdAt: bill.createdAt,
      };
      return NextResponse.json({ success: true, companies: [company] });
    }

    // Bill not assigned to any company
    return NextResponse.json({ success: true, companies: [] });
  } catch (e) {
    console.error('❌ GET /api/bills/[id]/assignments:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to get bill assignment', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
