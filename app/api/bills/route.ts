import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/bills
 * List all bills (templates for one-off billing)
 * 
 * Query params:
 * - status: Filter by status (PENDING, PAID, EXPIRED)
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'PENDING' | 'PAID' | 'EXPIRED' | null;

    // Build where clause
    const where = status && ['PENDING', 'PAID', 'EXPIRED'].includes(status)
      ? { status }
      : undefined;

    const bills = await prisma.bills.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        amountCents: true,
        currency: true,
        companyId: true,
        stripeCheckoutSessionId: true,
        checkoutUrl: true,
        status: true,
        slug: true,
        publicBillUrl: true,
        createdAt: true,
        updatedAt: true,
        // paidAt: true, // TODO: Uncomment after migration 20260128000002_add_paid_at_to_bills is deployed
        company_hqs: {
          select: { id: true, companyName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, bills });
  } catch (e) {
    console.error('❌ GET /api/bills:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to list bills' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bills
 * Create a bill (set bill). Same shape as plans, no interval.
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, amountCents, currency } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { success: false, error: 'Bill name is required' },
        { status: 400 }
      );
    }
    if (!amountCents || Number(amountCents) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    const bill = await prisma.bills.create({
      data: {
        name: String(name).trim(),
        description: description != null ? String(description).trim() || null : null,
        amountCents: Math.round(Number(amountCents)),
        currency: (currency && String(currency).toLowerCase()) || 'usd',
      },
    });

    return NextResponse.json({ success: true, bill });
  } catch (e) {
    console.error('❌ POST /api/bills:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to create bill' },
      { status: 500 }
    );
  }
}
