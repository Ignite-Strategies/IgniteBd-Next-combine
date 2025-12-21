import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { listVerifiedSenders } from '@/lib/sendgridSendersApi';

/**
 * GET /api/outreach/verified-senders/list
 * 
 * List all verified senders from SendGrid
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);

    const result = await listVerifiedSenders();
    
    return NextResponse.json({
      success: true,
      senders: result.senders,
    });
  } catch (error) {
    console.error('List verified senders error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list verified senders',
      },
      { status: 500 }
    );
  }
}

