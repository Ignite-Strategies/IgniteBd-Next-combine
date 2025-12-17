import { NextResponse } from 'next/server';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { lookupPerson } from '@/lib/apollo';

/**
 * GET /api/apollo-test
 * 
 * Test endpoint to verify Apollo API key and connection
 * Uses a fixed test email to confirm API key works
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Use a test email - you can change this to any valid email
    const testEmail = 'test@example.com';

    if (!process.env.APOLLO_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'APOLLO_API_KEY environment variable is not set',
        },
        { status: 500 },
      );
    }

    // Hit Apollo with the test email (using lookup for preview)
    const apolloResponse = await lookupPerson({ email: testEmail });

    // Return the raw Apollo JSON
    return NextResponse.json({
      success: true,
      message: 'Apollo API key is working',
      testEmail,
      apolloResponse,
    });
  } catch (error: any) {
    console.error('❌ Apollo test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Apollo API test failed',
        details: error.message,
        // Check if it's an API key issue
        apiKeyConfigured: !!process.env.APOLLO_API_KEY,
      },
      { status: 500 },
    );
  }
}
