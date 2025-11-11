import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getSendGridConfig } from '@/lib/sendgridClient';

/**
 * GET /api/email/config
 * 
 * Get SendGrid configuration status
 * Requires Firebase authentication
 */
export async function GET(request) {
  try {
    // Verify Firebase authentication
    await verifyFirebaseToken(request);

    const config = getSendGridConfig();

    return NextResponse.json({
      success: true,
      configured: config.configured,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
    });
  } catch (error) {
    console.error('Get email config error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get email configuration',
      },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

