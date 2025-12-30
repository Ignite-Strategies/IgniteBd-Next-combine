import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken, getFirebaseAdmin } from '@/lib/firebaseAdmin';

/**
 * POST /api/owner/password/reset
 * Generate password reset link for the authenticated owner
 */
export async function POST(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    // Find owner by firebaseId
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    if (!owner.email) {
      return NextResponse.json(
        { success: false, error: 'Owner email is required for password reset' },
        { status: 400 },
      );
    }

    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase admin not configured');
    }

    const auth = admin.auth();

    // Check if Firebase user exists for this email
    let firebaseUserRecord;
    try {
      firebaseUserRecord = await auth.getUserByEmail(owner.email);
    } catch (error) {
      // User doesn't exist in Firebase - this shouldn't happen for authenticated owners
      return NextResponse.json(
        { success: false, error: 'Firebase user not found for this email' },
        { status: 404 },
      );
    }

    // Generate password reset link
    // Use the main app URL for owners (not client portal)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL 
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
      : 'https://app.ignitegrowth.biz';
    
    const resetLink = await auth.generatePasswordResetLink(owner.email, {
      url: `${appUrl}/reset-password`, // Custom reset page (or Firebase default if not exists)
      handleCodeInApp: true, // Handle on our page instead of Firebase hosted page
    });

    console.log('✅ Password reset link generated for owner:', owner.id);

    return NextResponse.json({
      success: true,
      passwordResetLink: resetLink,
      email: owner.email,
      message: 'Password reset link generated successfully',
    });
  } catch (error) {
    console.error('❌ OwnerPasswordReset error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate password reset link',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

