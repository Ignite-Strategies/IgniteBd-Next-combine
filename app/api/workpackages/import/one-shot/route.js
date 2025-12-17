import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { parseCSV, normalizeWorkPackageCSVRow } from '@/lib/utils/csv';
import { hydrateWorkPackageFromCSV } from '@/lib/services/workpackageHydrationService';

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
 * POST /api/workpackages/import/one-shot
 * One-shot CSV import - fully hydrates WorkPackage with phases and items
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
    const formData = await request.formData();
    const file = formData.get('file');
    const workPackageClientId = formData.get('workPackageClientId') || formData.get('contactId'); // Support legacy
    const companyId = formData.get('companyId');
    const workPackageMemberId = formData.get('workPackageMemberId');
    const title = formData.get('title') || 'Imported Work Package';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'CSV file is required' },
        { status: 400 },
      );
    }

    if (!workPackageClientId) {
      return NextResponse.json(
        { success: false, error: 'workPackageClientId (or contactId) is required' },
        { status: 400 },
      );
    }

    // Get owner's companyHQId from Firebase auth
    const workPackageOwnerId = await getOwnerCompanyHQId(firebaseUser);

    // Verify client contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: workPackageClientId },
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

    // Parse CSV
    const csvText = await file.text();
    const parsed = parseCSV(csvText);

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'CSV parsing errors', errors: parsed.errors },
        { status: 400 },
      );
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file contains no data rows' },
        { status: 400 },
      );
    }

    // Normalize rows
    const normalizedRows = [];
    const errors = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const normalized = normalizeWorkPackageCSVRow(row);

      if (!normalized) {
        errors.push(`Row ${i + 2}: Invalid or missing required fields`);
        continue;
      }

      normalizedRows.push(normalized);
    }

    if (errors.length > 0 && normalizedRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'All rows failed validation', errors },
        { status: 400 },
      );
    }

    if (normalizedRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid rows found in CSV' },
        { status: 400 },
      );
    }

    // Extract proposal title from first row description or use provided title
    const proposalTitle = title || normalizedRows[0].proposalDescription || 'Imported Work Package';

    // Hydrate WorkPackage
    const result = await hydrateWorkPackageFromCSV({
      workPackageClientId,
      companyId: finalCompanyId,
      workPackageOwnerId,
      ...(workPackageMemberId && { workPackageMemberId }),
      title: proposalTitle,
      rows: normalizedRows,
    });

    // Fetch created work package with relations
    const workPackage = await prisma.work_packages.findUnique({
      where: { id: result.workPackageId },
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

    console.log('✅ WorkPackage imported from CSV:', result.workPackageId);

    return NextResponse.json({
      success: true,
      workPackage,
      summary: {
        workPackageId: result.workPackageId,
        phasesCreated: result.phasesCreated,
        phasesUpdated: result.phasesUpdated,
        itemsCreated: result.itemsCreated,
        itemsUpdated: result.itemsUpdated,
        totalEstimatedHours: result.totalEstimatedHours,
        warnings: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('❌ WorkPackage CSV import error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to import WorkPackage from CSV',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

