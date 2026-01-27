import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/billing/invoices
 * List invoices (platform-scoped)
 * 
 * Query params:
 * - platformId: REQUIRED - Filter by platform (ensures platform-scoped access)
 * - companyHQId: Filter by company
 * - invoiceType: Filter by type (PLATFORM_FEE, MONTHLY_RECURRING, CUSTOM, WORK_PACKAGE, PLAN_SUBSCRIPTION)
 * - status: Filter by status (NOT_PAID, PAID, PARTIAL)
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
    const platformId = searchParams.get('platformId');
    const companyHQId = searchParams.get('companyHQId');
    const invoiceType = searchParams.get('invoiceType');
    const status = searchParams.get('status');

    // Platform-scoped filtering is REQUIRED
    if (!platformId) {
      return NextResponse.json(
        { success: false, error: 'platformId is required for platform-scoped access' },
        { status: 400 },
      );
    }

    // Build where clause - filter by platform via company_hqs
    const where: any = {
      company_hqs: {
        platformId: platformId, // Platform-scoped filtering
      },
    };

    if (companyHQId) {
      where.companyHQId = companyHQId;
    }

    if (invoiceType) {
      where.invoiceType = invoiceType;
    }

    if (status) {
      where.status = status;
    }

    // Get invoices with relations - filtered by platform
    const invoices = await prisma.invoices.findMany({
      where,
      include: {
        company_hqs: {
          select: {
            id: true,
            companyName: true,
            platformId: true,
          },
        },
        invoice_milestones: {
          orderBy: { expectedDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format invoices for response
    const formattedInvoices = invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber || invoice.id.substring(0, 8),
      invoiceType: invoice.invoiceType,
      invoiceName: invoice.invoiceName,
      invoiceDescription: invoice.invoiceDescription,
      companyHQId: invoice.companyHQId,
      companyName: invoice.company_hqs?.companyName || 'Unknown Company',
      totalExpected: invoice.totalExpected,
      totalReceived: invoice.totalReceived,
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      isRecurring: invoice.isRecurring,
      nextBillingDate: invoice.nextBillingDate,
      lastBilledDate: invoice.lastBilledDate,
      paidAt: invoice.paidAt,
      stripeCheckoutSessionId: invoice.stripeCheckoutSessionId,
      stripePaymentIntentId: invoice.stripePaymentIntentId,
      stripeCustomerId: invoice.stripeCustomerId,
      stripeInvoiceId: invoice.stripeInvoiceId,
      stripeSubscriptionId: invoice.stripeSubscriptionId,
    }));

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices,
    });
  } catch (error) {
    console.error('❌ Get invoices error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get invoices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

