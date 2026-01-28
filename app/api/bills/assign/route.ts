import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/bills/assign
 *
 * Assign a company to a bill → creates bills_to_companies row (junction).
 * Like "membership": this bill is now assigned to this company.
 * No checkout link yet; use POST /api/bills/send for that.
 *
 * Body: { billId, companyId }
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { billId, companyId } = body ?? {};

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
        select: { id: true, companyName: true },
      }),
    ]);

    if (!bill) {
      return NextResponse.json({ success: false, error: 'Bill not found' }, { status: 404 });
    }
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const assignment = await prisma.bills_to_companies.create({
      data: {
        billId,
        companyId,
        status: 'PENDING',
      },
      include: {
        company_hqs: {
          select: { id: true, companyName: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      billId: assignment.billId,
      companyId: assignment.companyId,
      companyName: assignment.company_hqs.companyName,
      status: assignment.status,
      createdAt: assignment.createdAt,
    });
  } catch (e) {
    console.error('❌ POST /api/bills/assign:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to assign company to bill', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
