import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/activate
 * Validate invite token and return firebaseUid for password setup
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 },
      );
    }

    // Find invite token
    const invite = await prisma.inviteToken.findUnique({
      where: { token },
      include: { contact: true },
    });

    if (!invite) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 400 },
      );
    }

    if (invite.used) {
      return NextResponse.json(
        { success: false, error: 'Token already used' },
        { status: 400 },
      );
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Token expired' },
        { status: 400 },
      );
    }

    if (!invite.contact.firebaseUid) {
      return NextResponse.json(
        { success: false, error: 'Contact not linked to Firebase' },
        { status: 500 },
      );
    }

    // Mark token as used
    await prisma.inviteToken.update({
      where: { token },
      data: { used: true },
    });

    return NextResponse.json({
      success: true,
      uid: invite.contact.firebaseUid,
      email: invite.email,
      contactId: invite.contactId,
    });
  } catch (error) {
    console.error('❌ Activate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to activate',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

