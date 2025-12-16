import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createWorkPackage } from '@/lib/services/workpackageHydrationService';

/**
 * Helper: Get owner's companyHQId from Firebase token
 */
async function getOwnerCompanyHQId(firebaseUser) {
  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    include: {
      company_hqs_company_hqs_ownerIdToowners: {
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!owner) {
    throw new Error('Owner not found for Firebase user');
  }

  const companyHQId = owner.company_hqs_company_hqs_ownerIdToowners?.[0]?.id;
  
  if (!companyHQId) {
    throw new Error('Owner has no associated CompanyHQ');
  }

  return companyHQId;
}

/**
 * POST /api/workpackages/import/proposal
 * Step 1: Create WorkPackage with proposal metadata
 * Company-first: requires companyId, workPackageClientId, auto-sets workPackageOwnerId
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { 
      workPackageClientId, // Renamed from contactId
      companyId, 
      workPackageMemberId, // Optional
      title, 
      description, 
      totalCost, 
      effectiveStartDate 
    } = body;

    // Support legacy contactId for backward compatibility
    const clientContactId = workPackageClientId || body.contactId;

    if (!clientContactId || !title) {
      return NextResponse.json(
        { success: false, error: 'workPackageClientId (or contactId) and title are required' },
        { status: 400 },
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 },
      );
    }

    // Get owner's companyHQId from Firebase auth
    const workPackageOwnerId = await getOwnerCompanyHQId(firebaseUser);

    // Verify client contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: clientContactId },
      include: {
        companies: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Client contact not found' },
        { status: 404 },
      );
    }

    // Verify company exists
    const company = await prisma.companies.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    // Create WorkPackage
    const workPackageId = await createWorkPackage({
      workPackageClientId: clientContactId,
      companyId,
      workPackageOwnerId,
      ...(workPackageMemberId && { workPackageMemberId }),
      title,
      description,
      totalCost,
      effectiveStartDate: effectiveStartDate ? new Date(effectiveStartDate) : undefined,
    });

    const workPackage = await prisma.work_packages.findUnique({
      where: { id: workPackageId },
      include: {
        companies: {
          select: {
            id: true,
            companyName: true,
          },
        },
        workPackageOwner: {
          select: {
            id: true,
            companyName: true,
          },
        },
        workPackageClient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        workPackageMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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

