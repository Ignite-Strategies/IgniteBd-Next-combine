import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/senders/assign
 * 
 * Step 2: Assign verified sender to an owner
 * SuperAdmin only - assigns sender email/name to ownerId
 * 
 * Body:
 * {
 *   "ownerId": "owner-id-here",
 *   "email": "user@example.com",
 *   "name": "User Name" (optional)
 * }
 */
export async function POST(request) {
  try {
    // Require SuperAdmin - check manually to avoid redirect
    const firebaseUser = await verifyFirebaseToken(request);
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      include: { superAdmin: true },
    });

    if (!owner || !owner.superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - SuperAdmin access required' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { ownerId, email, name } = body;

    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'ownerId is required' },
        { status: 400 }
      );
    }

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

    // Verify owner exists
    const owner = await prisma.owners.findUnique({
      where: { id: ownerId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    // Update owner with verified sender info
    const updated = await prisma.owners.update({
      where: { id: ownerId },
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

    console.log(`✅ SuperAdmin assigned sender to owner ${ownerId}:`, {
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
    
    if (error.message?.includes('Unauthorized') || error.message?.includes('token')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to assign sender',
      },
      { status: 500 }
    );
  }
}

