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
    console.log('🚀 SuperAdmin Upsert: Starting...');

    // Verify Firebase token
    let firebaseUser;
    try {
      firebaseUser = await verifyFirebaseToken(request);
      console.log('✅ SuperAdmin Upsert: Firebase token verified', { uid: firebaseUser.uid, email: firebaseUser.email });
    } catch (authError) {
      console.error('❌ SuperAdmin Upsert: Auth error:', authError.message);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication required',
          details: authError.message 
        },
        { status: 401 },
      );
    }

    const firebaseId = firebaseUser.uid;

    // Optional: restrict who can become SuperAdmin
    const platformAdminEmail = process.env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL;
    if (platformAdminEmail && firebaseUser.email !== platformAdminEmail) {
      console.log('❌ SuperAdmin Upsert: Email restriction', { 
        userEmail: firebaseUser.email, 
        requiredEmail: platformAdminEmail 
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only platform admin can become SuperAdmin' },
        { status: 403 },
      );
    }

    // Get Owner
    console.log('🔍 SuperAdmin Upsert: Finding Owner by firebaseId:', firebaseId);
    const owner = await prisma.owner.findUnique({
      where: { firebaseId },
    });

    if (!owner) {
      console.error('❌ SuperAdmin Upsert: Owner not found for firebaseId:', firebaseId);
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    console.log('✅ SuperAdmin Upsert: Owner found', { ownerId: owner.id });

    // Upsert SuperAdmin
    console.log('🔄 SuperAdmin Upsert: Creating/updating SuperAdmin record...');
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

    console.log('✅ SuperAdmin Upsert: Success', { superAdminId: superAdmin.id, ownerId: owner.id });

    return NextResponse.json({
      success: true,
      superAdmin,
      message: 'SuperAdmin activated successfully',
    });
  } catch (error) {
    console.error('❌ Upsert SuperAdmin error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    
    // Return appropriate status code based on error type
    const statusCode = error.code === 'P2002' ? 409 : // Unique constraint violation
                      error.code === 'P2025' ? 404 : // Record not found
                      500;
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create/update SuperAdmin',
        details: error.message,
        code: error.code,
      },
      { status: statusCode },
    );
  }
}

