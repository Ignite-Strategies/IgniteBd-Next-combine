import { NextResponse } from 'next/server';
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
      return NextResponse.json(
        {
          success: false,
          error: 'Preview failed',
          details: error.message || 'Failed to fetch preview data',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      enrichedData,
    });
  } catch (error: any) {
    console.error('❌ Preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch preview',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

