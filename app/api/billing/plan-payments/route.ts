import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/billing/plan-payments
 * List plan subscription payment history for a company
 * 
 * Query params:
 * - companyHQId: REQUIRED - Company to get payment history for
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Verify company exists
    const company = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
      select: { id: true, companyName: true },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    // Get plan subscription payments (ordered by most recent first)
    const payments = await prisma.invoices.findMany({
      where: {
        companyHQId,
        invoiceType: 'PLAN_SUBSCRIPTION',
      },
      orderBy: { paidAt: 'desc' }, // Most recent first
    });

    // Format for response
    const formattedPayments = payments.map((payment) => ({
      id: payment.id,
      invoiceName: payment.invoiceName,
      invoiceDescription: payment.invoiceDescription,
      amountCents: payment.totalReceived,
      currency: payment.currency,
      paidAt: payment.paidAt,
      stripeInvoiceId: payment.stripeInvoiceId,
      stripeSubscriptionId: payment.stripeSubscriptionId,
      status: payment.status,
    }));

    return NextResponse.json({
      success: true,
      companyId: companyHQId,
      companyName: company.companyName,
      payments: formattedPayments,
      total: formattedPayments.length,
    });
  } catch (error) {
    console.error('❌ Get plan payments error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get plan payment history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
