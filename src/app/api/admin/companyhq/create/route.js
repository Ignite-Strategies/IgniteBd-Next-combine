import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/admin/companyhq/create
 * 
 * Create a new CompanyHQ (SuperAdmin only)
 * Mirrors /api/company/upsert fields but sets ownerId to SuperAdmin's owner ID
 * 
 * Payload:
 * {
 *   companyName: string (required),
 *   whatYouDo?: string,
 *   companyStreet?: string,
 *   companyCity?: string,
 *   companyState?: string,
 *   companyWebsite?: string,
 *   companyIndustry?: string,
 *   companyAnnualRev?: string,
 *   yearsInBusiness?: string,
 *   teamSize?: string
 * }
 * 
 * Note: ownerId is automatically set to the SuperAdmin's owner ID
 */
export async function POST(request) {
  try {
    // Verify Firebase token
    const firebaseUser = await verifyFirebaseToken(request);
    const firebaseId = firebaseUser.uid;

    // Get Owner
    const owner = await prisma.owner.findUnique({
      where: { firebaseId },
      include: {
        superAdmin: true,
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Check if SuperAdmin
    const isSuperAdmin = owner.superAdmin?.active === true;

    if (!isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: SuperAdmin access required' },
        { status: 403 },
      );
    }

    // Parse request body (matching /api/company/upsert structure)
    const body = await request.json();
    const {
      companyName,
      whatYouDo,
      companyStreet,
      companyCity,
      companyState,
      companyWebsite,
      companyIndustry,
      companyAnnualRev,
      yearsInBusiness,
      teamSize,
    } = body ?? {};

    if (!companyName || companyName.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Company name is required' },
        { status: 400 },
      );
    }

    // Auto-assign Ultra Tenant (Ignite Strategies)
    const ULTRA_TENANT_ID = 'cmhmdw78k0001mb1vioxdw2g8';

    // companyAnnualRev is now String? in schema, so we can store ranges like "500k-1m"

    // Create CompanyHQ with SuperAdmin as owner
    const companyHQ = await prisma.companyHQ.create({
      data: {
        companyName: companyName.trim(),
        whatYouDo: whatYouDo || null,
        companyStreet: companyStreet || null,
        companyCity: companyCity || null,
        companyState: companyState || null,
        companyWebsite: companyWebsite || null,
        companyIndustry: companyIndustry || null,
        companyAnnualRev: companyAnnualRev || null,
        yearsInBusiness: yearsInBusiness || null,
        teamSize: teamSize || null,
        ownerId: owner.id, // Set to SuperAdmin's owner ID
        ultraTenantId: ULTRA_TENANT_ID, // Auto-assign to Ignite Strategies
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contactOwner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        ultraTenant: {
          select: {
            id: true,
            companyName: true,
          },
        },
        subTenants: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      companyHQ,
      message: 'CompanyHQ created successfully',
    });
  } catch (error) {
    console.error('❌ Create CompanyHQ error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create CompanyHQ',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

