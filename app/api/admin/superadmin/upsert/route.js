import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/admin/superadmin/upsert
 * 
 * Phase 1: Simple SuperAdmin activation
 * - No request body required
 * - No email restrictions
 * - No env vars
 * - Just: valid token → find owner → create SuperAdmin
 */
export async function POST(request) {
  try {
    // Verify Firebase token
    const firebaseUser = await verifyFirebaseToken(request);
    if (!firebaseUser) {
      return NextResponse.json(
        { success: false, error: 'No auth' },
        { status: 401 },
      );
    }

    // Find Owner by firebaseId
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Upsert SuperAdmin - simple and direct
    // If record exists, it's already active (no active field needed)
    // If it doesn't exist, create it
    const superAdmin = await prisma.superAdmin.upsert({
      where: { ownerId: owner.id },
      update: {}, // No update needed - existence = active
      create: { ownerId: owner.id },
    });

    return NextResponse.json({
      success: true,
      superAdmin,
    });
  } catch (error) {
    console.error('❌ SuperAdmin Upsert error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create/update SuperAdmin',
      },
      { status: 500 },
    );
  }
}

