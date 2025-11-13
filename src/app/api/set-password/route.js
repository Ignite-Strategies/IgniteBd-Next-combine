import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { handleCorsPreflight, corsResponse } from '@/lib/cors';

/**
 * OPTIONS /api/set-password
 * Handle CORS preflight requests
 */
export async function OPTIONS(request) {
  return handleCorsPreflight(request);
}

/**
 * POST /api/set-password
 * Set password for Firebase user and mark contact as activated
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { uid, password, contactId } = body;

    if (!uid || !password) {
      return corsResponse(
        { success: false, error: 'uid and password are required' },
        400,
        request,
      );
    }

    if (password.length < 8) {
      return corsResponse(
        { success: false, error: 'Password must be at least 8 characters' },
        400,
        request,
      );
    }

    // Update Firebase user password
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase admin not configured');
    }

    await admin.auth().updateUser(uid, { password });

    // Update contact as activated (find by firebaseUid or contactId)
    if (contactId) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          isActivated: true,
          activatedAt: new Date(),
        },
      });
    } else {
      // Find by firebaseUid (which is unique)
      await prisma.contact.update({
        where: { firebaseUid: uid },
        data: {
          isActivated: true,
          activatedAt: new Date(),
        },
      });
    }

    return corsResponse(
      {
        success: true,
        message: 'Password set successfully',
      },
      200,
      request,
    );
  } catch (error) {
    console.error('❌ SetPassword error:', error);
    return corsResponse(
      {
        success: false,
        error: 'Failed to set password',
        details: error.message,
      },
      500,
      request,
    );
  }
}
