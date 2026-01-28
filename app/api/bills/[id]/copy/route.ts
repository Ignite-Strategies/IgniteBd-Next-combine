import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/bills/[id]/copy
 * Copy a bill - creates new bill with same details but unassigned (no companyId, no payment URL)
 * User can then assign it to same or different company
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const original = await prisma.bills.findUnique({
      where: { id },
    });

    if (!original) {
      return NextResponse.json({ success: false, error: 'Bill not found' }, { status: 404 });
    }

    // Create new bill with same details, but unassigned
    const copied = await prisma.bills.create({
      data: {
        name: `${original.name} (Copy)`,
        description: original.description,
        amountCents: original.amountCents,
        currency: original.currency,
        // No companyId - unassigned
        // No payment URL fields - will be generated on assignment
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      bill: copied,
      message: 'Bill copied. Assign it to a company to generate payment URL.',
    });
  } catch (e) {
    console.error('❌ POST /api/bills/[id]/copy:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to copy bill', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
