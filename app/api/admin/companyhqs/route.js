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
    const owner = await prisma.owners.findUnique({
      where: { firebaseId },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // NOTE: SuperAdmin check has been moved to platform manager
    // This endpoint may need to be moved to platform manager or use a different auth mechanism

    // Fetch all CompanyHQs
    const companyHQs = await prisma.company_hqs.findMany({
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

