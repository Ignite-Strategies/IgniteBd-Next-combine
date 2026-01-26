import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/billing/invoice-settings
 * Get invoice settings for a company
 * Query params: ?companyHQId=xxx
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

    // Get or create invoice settings
    let settings = await prisma.invoice_settings.findUnique({
      where: { companyHQId },
    });

    // If doesn't exist, create default
    if (!settings) {
      settings = await prisma.invoice_settings.create({
        data: {
          companyHQId,
          defaultCurrency: 'USD',
          autoGenerateNumber: true,
          nextInvoiceNumber: 1,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('❌ Get invoice settings error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get invoice settings',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/billing/invoice-settings
 * Create or update invoice settings for a company
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      companyHQId,
      platformFeeAmount,
      platformFeeDescription,
      monthlyRecurringAmount,
      monthlyRecurringDescription,
      invoicePrefix,
      invoiceNumberFormat,
      defaultCurrency,
      defaultPaymentTerms,
      defaultNotes,
      taxId,
      billingAddress,
      billingEmail,
      autoGenerateNumber,
      nextInvoiceNumber,
    } = body;

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Upsert invoice settings
    const settings = await prisma.invoice_settings.upsert({
      where: { companyHQId },
      create: {
        companyHQId,
        platformFeeAmount: platformFeeAmount ? Math.round(platformFeeAmount * 100) : null, // Convert dollars to cents
        platformFeeDescription,
        monthlyRecurringAmount: monthlyRecurringAmount ? Math.round(monthlyRecurringAmount * 100) : null, // Convert dollars to cents
        monthlyRecurringDescription,
        invoicePrefix,
        invoiceNumberFormat,
        defaultCurrency: defaultCurrency || 'USD',
        defaultPaymentTerms,
        defaultNotes,
        taxId,
        billingAddress,
        billingEmail,
        autoGenerateNumber: autoGenerateNumber !== undefined ? autoGenerateNumber : true,
        nextInvoiceNumber: nextInvoiceNumber || 1,
      },
      update: {
        ...(platformFeeAmount !== undefined && { platformFeeAmount: Math.round(platformFeeAmount * 100) }),
        ...(platformFeeDescription !== undefined && { platformFeeDescription }),
        ...(monthlyRecurringAmount !== undefined && { monthlyRecurringAmount: Math.round(monthlyRecurringAmount * 100) }),
        ...(monthlyRecurringDescription !== undefined && { monthlyRecurringDescription }),
        ...(invoicePrefix !== undefined && { invoicePrefix }),
        ...(invoiceNumberFormat !== undefined && { invoiceNumberFormat }),
        ...(defaultCurrency !== undefined && { defaultCurrency }),
        ...(defaultPaymentTerms !== undefined && { defaultPaymentTerms }),
        ...(defaultNotes !== undefined && { defaultNotes }),
        ...(taxId !== undefined && { taxId }),
        ...(billingAddress !== undefined && { billingAddress }),
        ...(billingEmail !== undefined && { billingEmail }),
        ...(autoGenerateNumber !== undefined && { autoGenerateNumber }),
        ...(nextInvoiceNumber !== undefined && { nextInvoiceNumber }),
      },
    });

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('❌ Update invoice settings error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update invoice settings',
        details: error.message,
      },
      { status: 500 },
    );
  }
}


