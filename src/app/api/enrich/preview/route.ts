import { NextResponse } from 'next/server';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { searchPersonByLinkedInUrl, normalizeApolloResponse } from '@/lib/apollo';
import type { ApolloPersonMatchResponse } from '@/lib/apollo';

/**
 * POST /api/enrich/preview
 * 
 * EXTERNAL SEARCH - LinkedIn URL lookup via Apollo
 * This is NOT a database lookup. This searches external data sources only.
 * 
 * Body:
 * {
 *   "linkedinUrl": "https://linkedin.com/in/..."
 * }
 * 
 * Returns: ContactPreview object (name, title, company, avatar, etc.)
 * Does NOT touch the database
 * Does NOT require contactId
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
    const { linkedinUrl } = body;

    // Validate linkedinUrl is provided
    if (!linkedinUrl) {
      return NextResponse.json(
        { success: false, error: 'linkedinUrl is required' },
        { status: 400 },
      );
    }

    // Validate LinkedIn URL format
    if (!linkedinUrl.includes('linkedin.com')) {
      return NextResponse.json(
        { success: false, error: 'Valid LinkedIn URL is required' },
        { status: 400 },
      );
    }

    // Call Apollo lookup (NOT enrichment - just preview)
    let apolloResponse: ApolloPersonMatchResponse;
    try {
      apolloResponse = await searchPersonByLinkedInUrl(linkedinUrl);
    } catch (error: any) {
      console.error('❌ Apollo preview error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        linkedinUrl,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Preview failed',
          details: error.message || 'Failed to fetch preview data from Apollo',
          errorType: error.name || 'UnknownError',
        },
        { status: 500 },
      );
    }

    // Normalize Apollo response into preview format
    const preview = normalizeApolloResponse(apolloResponse);

    // Return ContactPreview object
    return NextResponse.json({
      success: true,
      preview,
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

