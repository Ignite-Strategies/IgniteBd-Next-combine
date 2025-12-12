import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/billing/invoices/create
 * Create invoice with milestones
 * 
 * Request Body:
 * {
 *   workPackageId: string (required)
 *   invoiceName: string (required)
 *   invoiceDescription?: string
 *   milestones: [
 *     {
 *       label: string (required)
 *       expectedAmount: number (required, in dollars)
 *       expectedDate?: string (ISO date)
 *       description?: string
 *     }
 *   ]
 * }
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
    const { workPackageId, invoiceName, invoiceDescription, milestones } = body;

    // Validation
    if (!workPackageId) {
      return NextResponse.json(
        { success: false, error: 'workPackageId is required' },
        { status: 400 },
      );
    }

    if (!invoiceName || !invoiceName.trim()) {
      return NextResponse.json(
        { success: false, error: 'invoiceName is required' },
        { status: 400 },
      );
    }

    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one milestone is required' },
        { status: 400 },
      );
    }

    // Validate milestones
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.label || !m.label.trim()) {
        return NextResponse.json(
          { success: false, error: `Milestone ${i + 1}: label is required` },
          { status: 400 },
        );
      }
      if (!m.expectedAmount || m.expectedAmount <= 0) {
        return NextResponse.json(
          { success: false, error: `Milestone ${i + 1}: expectedAmount must be positive` },
          { status: 400 },
        );
      }
    }

    // Verify WorkPackage exists
    const workPackage = await prisma.workPackage.findUnique({
      where: { id: workPackageId },
    });

    if (!workPackage) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage not found' },
        { status: 404 },
      );
    }

    // Calculate totalExpected from milestones (convert to integer)
    const totalExpected = Math.round(
      milestones.reduce((sum, m) => sum + (m.expectedAmount || 0), 0)
    );

    // Create invoice with milestones in a transaction
    const invoice = await prisma.invoice.create({
      data: {
        workPackageId,
        invoiceName: invoiceName.trim(),
        invoiceDescription: invoiceDescription?.trim() || null,
        totalExpected,
        totalReceived: 0,
        status: 'pending',
        milestones: {
          create: milestones.map((m) => ({
            label: m.label.trim(),
            expectedAmount: Math.round(m.expectedAmount), // Convert to integer
            expectedDate: m.expectedDate ? new Date(m.expectedDate) : null,
            description: m.description?.trim() || null,
            status: 'pending',
          })),
        },
      },
      include: {
        workPackage: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
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
        payments: true,
      },
    });

    console.log('✅ Invoice created:', invoice.id);

    return NextResponse.json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error('❌ Create invoice error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create invoice',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

