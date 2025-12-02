import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/admin/companyhq/create
 * 
 * Create a new CompanyHQ (SuperAdmin only)
 * 
 * Payload:
 * {
 *   companyName: string (required),
 *   ownerId?: string,
 *   contactOwnerId?: string,
 *   managerId?: string
 * }
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

    // Parse request body
    const body = await request.json();
    const { companyName, ownerId, contactOwnerId, managerId } = body;

    if (!companyName || companyName.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'companyName is required' },
        { status: 400 },
      );
    }

    // Validate that at least one of ownerId, contactOwnerId, or managerId is provided
    if (!ownerId && !contactOwnerId && !managerId) {
      return NextResponse.json(
        { success: false, error: 'At least one of ownerId, contactOwnerId, or managerId must be provided' },
        { status: 400 },
      );
    }

    // Validate ownerId if provided
    if (ownerId) {
      const ownerExists = await prisma.owner.findUnique({
        where: { id: ownerId },
      });
      if (!ownerExists) {
        return NextResponse.json(
          { success: false, error: 'Owner not found' },
          { status: 404 },
        );
      }
    }

    // Validate contactOwnerId if provided
    if (contactOwnerId) {
      const contactExists = await prisma.contact.findUnique({
        where: { id: contactOwnerId },
      });
      if (!contactExists) {
        return NextResponse.json(
          { success: false, error: 'Contact not found' },
          { status: 404 },
        );
      }
    }

    // Validate managerId if provided
    if (managerId) {
      const managerExists = await prisma.owner.findUnique({
        where: { id: managerId },
      });
      if (!managerExists) {
        return NextResponse.json(
          { success: false, error: 'Manager not found' },
          { status: 404 },
        );
      }
    }

    // Auto-assign Ultra Tenant (Ignite Strategies)
    const ULTRA_TENANT_ID = 'cmhmdw78k0001mb1vioxdw2g8';

    // Create CompanyHQ
    const companyHQ = await prisma.companyHQ.create({
      data: {
        companyName: companyName.trim(),
        ownerId: ownerId || null,
        contactOwnerId: contactOwnerId || null,
        managerId: managerId || null,
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

