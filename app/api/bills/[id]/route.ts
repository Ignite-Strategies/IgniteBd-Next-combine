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
        _count: { select: { bills_to_companies: true } },
      },
    });

    if (!bill) {
      return NextResponse.json({ success: false, error: 'Bill not found' }, { status: 404 });
    }

    const { _count, ...rest } = bill;
    return NextResponse.json({
      success: true,
      bill: { ...rest, sendCount: _count.bills_to_companies },
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
    const { name, description, amountCents, currency } = body;

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

    const bill = await prisma.bills.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && {
          description: description != null ? String(description).trim() || null : null,
        }),
        ...(amountCents !== undefined && { amountCents: Math.round(Number(amountCents)) }),
        ...(currency !== undefined && { currency: String(currency).toLowerCase() }),
      },
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
 * Delete a bill (cascades to bills_to_companies)
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
