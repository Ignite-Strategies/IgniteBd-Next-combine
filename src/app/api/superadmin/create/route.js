import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/superadmin/create
 * 
 * Create a SuperAdmin record for the authenticated Owner.
 * 
 * Flow:
 * 1. Verify Firebase token
 * 2. Find Owner by firebaseId
 * 3. Create SuperAdmin record (or return existing)
 * 
 * No request body required - uses authenticated Owner.
 */
export async function POST(request) {
  try {
    // Step 1: Verify Firebase token
    const firebaseUser = await verifyFirebaseToken(request);
    if (!firebaseUser) {
      return NextResponse.json(
        { success: false, error: 'No auth' },
        { status: 401 },
      );
    }

    // Step 2: Find Owner by firebaseId
    const owner = await prisma.owner.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Step 3: Check if SuperAdmin already exists
    const existingSuperAdmin = await prisma.superAdmin.findUnique({
      where: { ownerId: owner.id },
    });

    if (existingSuperAdmin) {
      // Already exists - return it
      return NextResponse.json({
        success: true,
        superAdmin: existingSuperAdmin,
        message: 'SuperAdmin already exists',
      });
    }

    // Step 4: Create SuperAdmin record
    const superAdmin = await prisma.superAdmin.create({
      data: {
        ownerId: owner.id,
        active: true,
      },
    });

    console.log('✅ SuperAdmin created:', {
      id: superAdmin.id,
      ownerId: superAdmin.ownerId,
      ownerEmail: owner.email,
    });

    return NextResponse.json({
      success: true,
      superAdmin,
    });
  } catch (error) {
    console.error('❌ SuperAdmin Create error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create SuperAdmin',
      },
      { status: 500 },
    );
  }
}

