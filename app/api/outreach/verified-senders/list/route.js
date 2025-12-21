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
    
    console.log(`✅ Retrieved ${result.senders?.length || 0} senders from SendGrid`);
    if (result.senders && result.senders.length > 0) {
      console.log('Sample sender structure:', JSON.stringify(result.senders[0], null, 2));
    }
    
    return NextResponse.json({
      success: true,
      senders: result.senders || [],
    });
  } catch (error) {
    console.error('List verified senders error:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list verified senders',
      },
      { status: 500 }
    );
  }
}

