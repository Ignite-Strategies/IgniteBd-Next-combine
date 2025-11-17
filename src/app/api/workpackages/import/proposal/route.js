import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createWorkPackage } from '@/lib/services/workpackageHydrationService';

/**
 * POST /api/workpackages/import/proposal
 * Step 1: Create WorkPackage with proposal metadata
 */
export async function POST(request) {
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
    const { contactId, companyId, title, description, totalCost, effectiveStartDate } = body;

    if (!contactId || !title) {
      return NextResponse.json(
        { success: false, error: 'contactId and title are required' },
        { status: 400 },
      );
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Create WorkPackage
    const workPackageId = await createWorkPackage({
      contactId,
      companyId,
      title,
      description,
      totalCost,
      effectiveStartDate: effectiveStartDate ? new Date(effectiveStartDate) : undefined,
    });

    const workPackage = await prisma.workPackage.findUnique({
      where: { id: workPackageId },
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
    });

    return NextResponse.json({
      success: true,
      workPackage,
    });
  } catch (error) {
    console.error('❌ Create WorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create WorkPackage',
      },
      { status: 500 },
    );
  }
}

