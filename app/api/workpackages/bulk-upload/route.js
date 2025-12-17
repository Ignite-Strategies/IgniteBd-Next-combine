import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

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
 * POST /api/workpackages/bulk-upload
 * Bulk upload work package with phases and items
 * Supports CSV upload or multi-row form data
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
      rows 
    } = body;

    // Support legacy contactId for backward compatibility
    const clientContactId = workPackageClientId || body.contactId;

    if (!clientContactId) {
      return NextResponse.json(
        { success: false, error: 'workPackageClientId (or contactId) is required' },
        { status: 400 },
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 },
      );
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'rows array is required' },
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

    // Auto-populate companyId from contact's company if not provided
    let finalCompanyId = companyId;
    if (!finalCompanyId && contact.companies) {
      finalCompanyId = contact.companies.id;
    } else if (!finalCompanyId && contact.contactCompanyId) {
      finalCompanyId = contact.contactCompanyId;
    }

    if (!finalCompanyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required. Contact has no associated company.' },
        { status: 400 },
      );
    }

    // Verify company exists
    const company = await prisma.companies.findUnique({
      where: { id: finalCompanyId },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    // Phase deduplication and ordering
    const phaseMap = new Map(); // phaseName -> { name, position, timeline }
    const itemsByPhase = new Map(); // phaseName -> [items]

    rows.forEach((row) => {
      const phaseName = row.phaseName?.trim() || 'Unnamed Phase';
      const position = parseInt(row.phasePosition) || 1;
      const timeline = row.phaseTimeline?.trim() || null;

      if (!phaseMap.has(phaseName)) {
        phaseMap.set(phaseName, {
          name: phaseName,
          position: position,
          timeline: timeline,
        });
        itemsByPhase.set(phaseName, []);
      } else {
        // Update position if higher
        const existing = phaseMap.get(phaseName);
        if (position > existing.position) {
          existing.position = position;
        }
        if (timeline && !existing.timeline) {
          existing.timeline = timeline;
        }
      }

      // Add item to phase
      itemsByPhase.get(phaseName).push({
        itemType: row.itemType?.trim() || 'blog',
        itemLabel: row.itemLabel?.trim() || 'Untitled Item',
        itemDescription: row.itemDescription?.trim() || null,
        quantity: parseInt(row.quantity) || 1,
      });
    });

    // Sort phases by position
    const phases = Array.from(phaseMap.values()).sort((a, b) => a.position - b.position);

    // Create WorkPackage
    const workPackage = await prisma.work_packages.create({
      data: {
        companyId: finalCompanyId,
        workPackageOwnerId,
        workPackageClientId: clientContactId,
        ...(workPackageMemberId && { workPackageMemberId }),
        title: 'Bulk Uploaded Work Package',
        work_package_phases: {
          create: phases.map((phase, index) => ({
            name: phase.name,
            position: phase.position || index + 1,
            description: phase.timeline,
            work_package_items: {
              create: itemsByPhase.get(phase.name).map((item) => ({
                deliverableType: item.itemType,
                deliverableLabel: item.itemLabel,
                deliverableDescription: item.itemDescription,
                itemType: item.itemType, // Legacy field
                itemLabel: item.itemLabel, // Legacy field
                itemDescription: item.itemDescription, // Legacy field
                quantity: item.quantity,
                unitOfMeasure: 'item',
                estimatedHoursEach: 1,
                status: 'NOT_STARTED',
              })),
            },
          })),
        },
      },
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

    return NextResponse.json({
      success: true,
      workPackage,
    });
  } catch (error) {
    console.error('❌ BulkUploadWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

