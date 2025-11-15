import { NextResponse } from 'next/server';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { enrichPerson, normalizeApolloResponse, type NormalizedContactData } from '@/lib/apollo';

/**
 * POST /api/enrich/enrich
 * 
 * EXTERNAL ENRICHMENT - Deep enrichment via Apollo
 * This does NOT write to the database. It only enriches and returns data.
 * 
 * Body:
 * {
 *   "linkedinUrl": "https://linkedin.com/in/..." (optional if email provided)
 *   "email": "foo@bar.com" (optional if linkedinUrl provided)
 * }
 * 
 * Returns: Enriched profile data
 * Does NOT touch the database
 * Does NOT create or update contacts
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
    const { linkedinUrl, email } = body;

    // Validate that either linkedinUrl or email is provided
    if (!linkedinUrl && !email) {
      return NextResponse.json(
        { success: false, error: 'Either linkedinUrl or email is required' },
        { status: 400 },
      );
    }

    if (email && !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 },
      );
    }

    if (linkedinUrl && !linkedinUrl.includes('linkedin.com')) {
      return NextResponse.json(
        { success: false, error: 'Valid LinkedIn URL is required' },
        { status: 400 },
      );
    }

    // Call Apollo ENRICHMENT using /people/enrich (deep lookup)
    // This person is NOT a CRM contact yet - they don't exist in our database
    let enrichedData: NormalizedContactData;
    try {
      // Enrich by linkedinUrl if provided, otherwise by email
      const apolloResponse = await enrichPerson({ linkedinUrl, email });
      enrichedData = normalizeApolloResponse(apolloResponse);
    } catch (error: any) {
      console.error('❌ Apollo enrichment error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Enrichment failed',
          details: error.message || 'Failed to enrich contact from Apollo',
        },
        { status: 500 },
      );
    }

    // Return enriched data (NO database writes)
    return NextResponse.json({
      success: true,
      enrichedProfile: enrichedData,
    });
  } catch (error: any) {
    console.error('❌ Enrich route error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to enrich contact',
        details: error.message || 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}

