import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/owner/sender/assign
 * 
 * User-facing: Assign verified sender to authenticated owner
 * Auto-assigns to the owner making the request (no ownerId needed)
 * 
 * Body:
 * {
 *   "email": "user@example.com",
 *   "name": "User Name" (optional)
 * }
 */
export async function POST(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);
    
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get or find Owner record
    let owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!owner) {
      // Create owner if it doesn't exist
      owner = await prisma.owners.create({
        data: {
          firebaseId: firebaseUser.uid,
          email: firebaseUser.email || null,
          name: firebaseUser.name || null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
    }

    // Update owner with verified sender info
    const updated = await prisma.owners.update({
      where: { id: owner.id },
      data: {
        sendgridVerifiedEmail: email,
        sendgridVerifiedName: name || null,
      },
      select: {
        id: true,
        email: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
      },
    });

    console.log(`✅ User assigned sender to their own account (${owner.id}):`, {
      email: updated.sendgridVerifiedEmail,
      name: updated.sendgridVerifiedName,
    });

    return NextResponse.json({
      success: true,
      owner: updated,
      message: 'Sender assigned successfully',
    });
  } catch (error) {
    console.error('Assign sender error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to assign sender',
      },
      { status: 500 }
    );
  }
}




