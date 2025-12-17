import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/billing/invoices/[invoiceId]
 * Get invoice details with milestones and payments
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { invoiceId } = await params;
    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: 'Invoice ID is required' },
        { status: 400 },
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        workPackage: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                goesBy: true,
              },
            },
            company: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
        milestones: {
          orderBy: { expectedDate: 'asc' },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
          include: {
            milestone: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 },
      );
    }

    // Calculate derived fields
    const outstandingAmount = invoice.totalExpected - invoice.totalReceived;
    const lastPayment = invoice.payments.length > 0 ? invoice.payments[0].paidAt : null;

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        outstandingAmount: Math.max(0, outstandingAmount),
        lastPaymentDate: lastPayment,
      },
    });
  } catch (error) {
    console.error('❌ Get invoice error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get invoice',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

