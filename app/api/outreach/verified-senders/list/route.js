import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { listSenders } from '@/lib/sendgridSendersApi';

/**
 * GET /api/outreach/verified-senders/list
 * 
 * List all senders from SendGrid
 * Client should filter for verified === true
 * 
 * Uses GET /v3/senders (the only endpoint we should use)
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);

    const result = await listSenders();
    const allSenders = result.senders || [];
    
    console.log(`✅ Retrieved ${allSenders.length} senders from SendGrid`);
    if (allSenders.length > 0) {
      console.log('Sample sender structure:', JSON.stringify(allSenders[0], null, 2));
      
      // Filter verified senders server-side for convenience
      const verifiedSenders = allSenders.filter(sender => sender.verified === true);
      console.log(`✅ Found ${verifiedSenders.length} verified senders`);
      
      return NextResponse.json({
        success: true,
        senders: verifiedSenders, // Return only verified ones
        allSenders: allSenders, // Also return all for debugging
      });
    }
    
    return NextResponse.json({
      success: true,
      senders: [],
      allSenders: [],
    });
  } catch (error) {
    console.error('List senders error:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list senders',
      },
      { status: 500 }
    );
  }
}

