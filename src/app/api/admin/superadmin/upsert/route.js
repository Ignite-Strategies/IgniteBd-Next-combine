import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/admin/superadmin/upsert
 * 
 * Create or update SuperAdmin record
 * 
 * Optional: restrict to specific email via NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL
 */
export async function POST(request) {
  try {
    // Verify Firebase token
    const firebaseUser = await verifyFirebaseToken(request);
    const firebaseId = firebaseUser.uid;

    // Optional: restrict who can become SuperAdmin
    const platformAdminEmail = process.env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL;
    if (platformAdminEmail && firebaseUser.email !== platformAdminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only platform admin can become SuperAdmin' },
        { status: 403 },
      );
    }

    // Get Owner
    const owner = await prisma.owner.findUnique({
      where: { firebaseId },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Upsert SuperAdmin
    const superAdmin = await prisma.superAdmin.upsert({
      where: { ownerId: owner.id },
      update: {
        active: true, // Ensure it's active
      },
      create: {
        ownerId: owner.id,
        active: true,
      },
    });

    return NextResponse.json({
      success: true,
      superAdmin,
      message: 'SuperAdmin activated successfully',
    });
  } catch (error) {
    console.error('❌ Upsert SuperAdmin error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create/update SuperAdmin',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

