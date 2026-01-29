import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/bills/[id]
 * Get a single bill (e.g. for "From template" or edit)
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
    const { id } = await params;
    const bill = await prisma.bills.findUnique({
      where: { id },
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
  } catch (e) {
    console.error('❌ GET /api/bills/[id]:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to get bill' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bills/[id]
 * Update a bill (set bill)
 */
export async function PUT(
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
    const body = await request.json();
    const { name, description, amountCents, currency, status, paidAt } = body;

    const existing = await prisma.bills.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Bill not found' }, { status: 404 });
    }

    if (name !== undefined && (!name || !String(name).trim())) {
      return NextResponse.json(
        { success: false, error: 'Bill name cannot be empty' },
        { status: 400 }
      );
    }
    if (amountCents !== undefined && Number(amountCents) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }
    if (status !== undefined && !['PENDING', 'PAID', 'EXPIRED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be PENDING, PAID, or EXPIRED' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (description !== undefined) {
      updateData.description = description != null ? String(description).trim() || null : null;
    }
    if (amountCents !== undefined) updateData.amountCents = Math.round(Number(amountCents));
    if (currency !== undefined) updateData.currency = String(currency).toLowerCase();
    if (status !== undefined) updateData.status = status;
    if (paidAt !== undefined) {
      // If setting status to PAID and paidAt is provided, use it; otherwise use current time
      updateData.paidAt = paidAt ? new Date(paidAt) : new Date();
    } else if (status === 'PAID' && !existing.paidAt) {
      // If marking as PAID and no paidAt provided, set to now
      updateData.paidAt = new Date();
    }

    const bill = await prisma.bills.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, bill });
  } catch (e) {
    console.error('❌ PUT /api/bills/[id]:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to update bill' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bills/[id]
 * Delete a bill
 */
export async function DELETE(
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
    const existing = await prisma.bills.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Bill not found' }, { status: 404 });
    }

    await prisma.bills.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Bill deleted' });
  } catch (e) {
    console.error('❌ DELETE /api/bills/[id]:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bill' },
      { status: 500 }
    );
  }
}
