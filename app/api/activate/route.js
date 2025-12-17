import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleCorsPreflight, corsResponse } from '@/lib/cors';

/**
 * OPTIONS /api/activate
 * Handle CORS preflight requests
 */
export async function OPTIONS(request) {
  return handleCorsPreflight(request);
}

/**
 * POST /api/activate
 * Verify invite token and return redirect URL for password setup
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return corsResponse(
        { success: false, error: 'Token is required' },
        400,
        request,
      );
    }

    // Find invite token - only select firebaseUid from contact
    const invite = await prisma.inviteToken.findUnique({
      where: { token },
      select: {
        id: true,
        contactId: true,
        email: true,
        token: true,
        used: true,
        expiresAt: true,
        contact: {
          select: {
            firebaseUid: true,
          },
        },
      },
    });

    if (!invite) {
      return corsResponse(
        { success: false, error: 'Invalid token' },
        400,
        request,
      );
    }

    if (invite.used) {
      return corsResponse(
        { success: false, error: 'Token has already been used' },
        400,
        request,
      );
    }

    if (invite.expiresAt < new Date()) {
      return corsResponse(
        { success: false, error: 'Token has expired' },
        400,
        request,
      );
    }

    // Mark token as used
    await prisma.inviteToken.update({
      where: { token },
      data: { used: true },
    });

    // Return redirect URL with Firebase UID
    const clientPortalUrl = 'https://clientportal.ignitegrowth.biz';
    const redirectUrl = `${clientPortalUrl}/set-password?uid=${invite.contact.firebaseUid}&email=${encodeURIComponent(invite.email)}&contactId=${invite.contactId}`;

    return corsResponse(
      {
        success: true,
        url: redirectUrl,
        uid: invite.contact.firebaseUid,
        email: invite.email,
        contactId: invite.contactId,
      },
      200,
      request,
    );
  } catch (error) {
    console.error('❌ Activate error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    
    // Return more detailed error in development
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code,
        }
      : { message: error.message };
    
    return corsResponse(
      {
        success: false,
        error: 'Failed to activate token',
        details: errorDetails,
      },
      500,
      request,
    );
  }
}
