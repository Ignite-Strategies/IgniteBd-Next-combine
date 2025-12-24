import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/owner/sender/verify-and-assign
 * 
 * User-facing: Assign sender to authenticated owner from database
 * No SendGrid verification - just assign based on what's in owner's db record
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
        { success: false, error: 'Email is required' },
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

    // Update owner with sender info (assign directly to database)
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
      verified: true,
      assigned: true,
      sender: {
        id: owner.id,
        email: updated.sendgridVerifiedEmail,
        name: updated.sendgridVerifiedName || updated.sendgridVerifiedEmail,
        verified: true,
      },
      owner: updated,
      message: 'Sender assigned successfully',
    });
  } catch (error) {
    console.error('Assign sender error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to assign sender',
        verified: false,
        assigned: false,
      },
      { status: 500 }
    );
  }
}

