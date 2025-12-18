import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * WorkPackage Route - Company-First Architecture
 * Work packages belong to companies, with owner (IgniteBD) and client (Contact) relationships
 */

/**
 * Helper: Get owner's companyHQId from Firebase token and verify membership
 */
async function getOwnerCompanyHQId(firebaseUser) {
  // Find owner by firebaseId
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

  // Get companyHQId from the relation
  const companyHQId = owner.company_hqs_company_hqs_ownerIdToowners?.[0]?.id;
  
  if (!companyHQId) {
    throw new Error('Owner has no associated CompanyHQ');
  }

  // Membership guard
  const { membership } = await resolveMembership(owner.id, companyHQId);
  if (!membership) {
    throw new Error('Forbidden: No membership in this CompanyHQ');
  }

  return companyHQId;
}

/**
 * POST /api/workpackages
 * Create or update WorkPackage (upsert by companyId + title)
 * Company-first: requires companyId, workPackageClientId, and auto-sets workPackageOwnerId from Firebase auth
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
      companyId,           // Required - client company
      workPackageClientId, // Required - client contact (renamed from contactId)
      workPackageMemberId, // Optional - member contact
      title,               // Required for upsert
      description,
      prioritySummary,
      totalCost,
      effectiveStartDate,
      status,
      metadata,
      tags,
    } = body ?? {};

    // Validate required fields
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 },
      );
    }

    if (!workPackageClientId) {
      return NextResponse.json(
        { success: false, error: 'workPackageClientId is required' },
        { status: 400 },
      );
    }

    // Get owner's companyHQId from Firebase auth
    const workPackageOwnerId = await getOwnerCompanyHQId(firebaseUser);

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

    // Verify client contact exists
    const clientContact = await prisma.contact.findUnique({
      where: { id: workPackageClientId },
      include: {
        companies: true, // Get contact's company
      },
    });

    if (!clientContact) {
      return NextResponse.json(
        { success: false, error: 'Client contact not found' },
        { status: 404 },
      );
    }

    // Verify member contact if provided
    if (workPackageMemberId) {
      const memberContact = await prisma.contact.findUnique({
        where: { id: workPackageMemberId },
      });

      if (!memberContact) {
        return NextResponse.json(
          { success: false, error: 'Member contact not found' },
          { status: 404 },
        );
      }
    }

    // Prepare data for create/update
    const workPackageData = {
      companyId,
      workPackageOwnerId,
      workPackageClientId,
      ...(workPackageMemberId && { workPackageMemberId }),
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(prioritySummary !== undefined && { prioritySummary }),
      ...(totalCost !== undefined && { totalCost }),
      ...(effectiveStartDate && { effectiveStartDate: new Date(effectiveStartDate) }),
      ...(status && { status }),
      ...(metadata && { metadata }),
      ...(tags && { tags }),
    };

    // Upsert logic: If ID provided, update; otherwise create new
    let workPackage;
    
    if (body.id) {
      // Update existing work package
      workPackage = await prisma.work_packages.update({
        where: { id: body.id },
        data: workPackageData,
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
          work_package_phases: {
            include: {
              work_package_items: true,
            },
            orderBy: { position: 'asc' },
          },
        },
      });
    } else {
      // Create new work package
      workPackage = await prisma.work_packages.create({
        data: workPackageData,
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
          work_package_phases: {
            include: {
              work_package_items: true,
            },
            orderBy: { position: 'asc' },
          },
        },
      });
    }

    console.log('✅ WorkPackage saved:', workPackage.id);

    return NextResponse.json({
      success: true,
      workPackage,
    });
  } catch (error) {
    console.error('❌ SaveWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/workpackages?id=xxx OR ?companyId=xxx OR ?workPackageClientId=xxx
 * Get WorkPackage(s) - company-first filtering
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const companyId = searchParams.get('companyId');
    const workPackageClientId = searchParams.get('workPackageClientId');
    const workPackageOwnerId = searchParams.get('workPackageOwnerId');
    const search = searchParams.get('search');

    if (id) {
      // Get single WorkPackage
      const workPackage = await prisma.work_packages.findUnique({
        where: { id },
        include: {
          companies: {
            select: {
              id: true,
              companyName: true,
              companyHQId: true,
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
          work_package_phases: {
            include: {
              work_package_items: true,
            },
            orderBy: { position: 'asc' },
          },
        },
      });

      if (!workPackage) {
        return NextResponse.json(
          { success: false, error: 'WorkPackage not found' },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        workPackage,
      });
    }

    // List WorkPackages - company-first filtering
    const where = {};
    
    // Filter by companyId (direct - company-first!)
    if (companyId) {
      where.companyId = companyId;
    }
    
    // Filter by client contact
    if (workPackageClientId) {
      where.workPackageClientId = workPackageClientId;
    }
    
    // Filter by owner (IgniteBD owner)
    if (workPackageOwnerId) {
      where.workPackageOwnerId = workPackageOwnerId;
    }
    
    // Search by workpackage title
    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // For list view, return minimal data
    const workPackages = await prisma.work_packages.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        totalCost: true,
        effectiveStartDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
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
        // Only include counts, not full objects
        _count: {
          select: {
            work_package_phases: true,
            work_package_items: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      workPackages,
    });
  } catch (error) {
    console.error('❌ GetWorkPackages error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get work packages',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

