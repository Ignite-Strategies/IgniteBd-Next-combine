import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/bills/by-company/[companyId]
 * Get all bills for a company (many bills → one company)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { companyId } = await params;

    const company = await prisma.company_hqs.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true },
    });

    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const bills = await prisma.bills.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        companyName: company.companyName,
      },
      bills,
    });
  } catch (e) {
    console.error('❌ GET /api/bills/by-company/[companyId]:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to get bills for company', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
