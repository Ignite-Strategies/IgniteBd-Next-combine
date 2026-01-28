import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/bills/by-url?url=xxx
 * Find bill(s) by payment URL (publicBillUrl)
 * Query param: ?findFirst=true (default) or ?findAll=true
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const findAll = searchParams.get('findAll') === 'true';

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'url query parameter is required' },
        { status: 400 }
      );
    }

    if (findAll) {
      // Find all bills with this URL
      const bills = await prisma.bills.findMany({
        where: { publicBillUrl: url },
        include: {
          company_hqs: {
            select: { id: true, companyName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        success: true,
        bills,
        count: bills.length,
      });
    } else {
      // Find first bill with this URL
      const bill = await prisma.bills.findFirst({
        where: { publicBillUrl: url },
        include: {
          company_hqs: {
            select: { id: true, companyName: true },
          },
        },
      });

      if (!bill) {
        return NextResponse.json({ success: false, error: 'Bill not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        bill,
      });
    }
  } catch (e) {
    console.error('❌ GET /api/bills/by-url:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to find bill by URL', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
