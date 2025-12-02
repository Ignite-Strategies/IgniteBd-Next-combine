import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/admin/companyhqs
 * 
 * List all CompanyHQs (SuperAdmin only)
 * 
 * Returns:
 * - Array of all CompanyHQs with owner/manager info
 */
export async function GET(request) {
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

    // Fetch all CompanyHQs
    let companyHQs;
    try {
      companyHQs = await prisma.companyHQ.findMany({
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
          _count: {
            select: {
              companies: true,
              contacts: true,
              proposals: true,
              subTenants: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      // If ultraTenantId column doesn't exist, migration hasn't been run
      if (error.code === 'P2022' && error.message?.includes('ultraTenantId')) {
        console.error('❌ Migration not applied: ultraTenantId column missing');
        return NextResponse.json(
          {
            success: false,
            error: 'Database migration required',
            message: 'The ultraTenantId column does not exist. Please run: node scripts/apply-ultra-tenant-migration.js',
            code: 'MIGRATION_REQUIRED',
          },
          { status: 500 },
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      companyHQs,
    });
  } catch (error) {
    console.error('❌ Get CompanyHQs error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch CompanyHQs',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

