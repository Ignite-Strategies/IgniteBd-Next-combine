import { NextResponse } from 'next/server';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { enrichContact } from '@/lib/apollo';

/**
 * POST /api/contacts/enrich/preview
 * 
 * Preview enrichment data without saving to database
 * 
 * Body:
 * {
 *   "email": "foo@bar.com" (optional if linkedinUrl provided)
 *   "linkedinUrl": "https://linkedin.com/in/..." (optional if email provided)
 * }
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { email, linkedinUrl } = body;

    if (!email && !linkedinUrl) {
      return NextResponse.json(
        { success: false, error: 'Either email or linkedinUrl is required' },
        { status: 400 },
      );
    }

    if (email && !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 },
      );
    }

    // Fetch enrichment data from Apollo (preview only, no database save)
    let enrichedData;
    try {
      enrichedData = await enrichContact(email, linkedinUrl);
    } catch (error: any) {
      console.error('❌ Apollo preview error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        email,
        linkedinUrl,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Preview failed',
          details: error.message || 'Failed to fetch preview data',
          errorType: error.name || 'UnknownError',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      enrichedData,
    });
  } catch (error: any) {
    console.error('❌ Preview route error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch preview',
        details: error.message || 'Unknown error occurred',
        errorType: error.name || 'UnknownError',
      },
      { status: 500 },
    );
  }
}

