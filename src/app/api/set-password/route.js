import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

/**
 * POST /api/set-password
 * Set password on Firebase user and mark contact as activated
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { uid, password, contactId } = body;

    if (!uid || !password) {
      return NextResponse.json(
        { success: false, error: 'uid and password are required' },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    // Update Firebase user password
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase admin not configured');
    }

    await admin.auth().updateUser(uid, { password });

    // Mark contact as activated
    if (contactId) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          isActivated: true,
          activatedAt: new Date(),
        },
      });
    } else {
      // Fallback: find by firebaseUid
      await prisma.contact.updateMany({
        where: { firebaseUid: uid },
        data: {
          isActivated: true,
          activatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Password set successfully',
    });
  } catch (error) {
    console.error('❌ Set password error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to set password',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

