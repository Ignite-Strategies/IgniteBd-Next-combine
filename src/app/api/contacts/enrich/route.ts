import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { enrichPerson, normalizeApolloResponse, type NormalizedContactData } from '@/lib/apollo';
import { storeEnrichedContactByContactId } from '@/lib/redis';

/**
 * POST /api/contacts/enrich
 * 
 * INTERNAL CRM CONTACT ENRICHMENT
 * This route enriches EXISTING contacts only (by contactId).
 * 
 * IMPORTANT: This route is ONLY for enriching existing contacts in your CRM.
 * For LinkedIn URL enrichment from external sources, use:
 * - POST /api/enrich/preview (for preview)
 * - POST /api/enrich/confirm (for confirm + upsert)
 * 
 * Body:
 * {
 *   "contactId": "xxxx", // Required - existing contact ID
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
    const { contactId, email, linkedinUrl } = body;

    // Validate inputs
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

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

    // Lookup the existing Contact by ID
    const existingContact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!existingContact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Enrich contact using Apollo ENRICHMENT (/people/enrich - deep lookup)
    let rawApolloResponse: any;
    let enrichedData: NormalizedContactData;
    try {
      const apolloResponse = await enrichPerson({ email, linkedinUrl });
      rawApolloResponse = apolloResponse;
      enrichedData = normalizeApolloResponse(apolloResponse);
      console.log('✅ Enrichment successful');
    } catch (error: any) {
      console.error('❌ Apollo enrichment error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Enrichment failed',
          details: error.message || 'Failed to enrich contact',
        },
        { status: 500 },
      );
    }

    // Store raw enrichment payload in Redis ONLY (not in database)
    let redisKey = '';
    try {
      redisKey = await storeEnrichedContactByContactId(contactId, rawApolloResponse);
      console.log('✅ Raw enrichment stored in Redis:', redisKey);
    } catch (redisError: any) {
      console.warn('⚠️ Redis store failed (non-critical):', redisError.message);
      // Continue - we can still return preview data
    }

    // Return preview data (normalized fields + intelligence scores for preview)
    // User must call /api/contacts/enrich/save to persist to database
    return NextResponse.json({
      success: true,
      enrichedContact: enrichedData,
      rawApolloResponse: rawApolloResponse, // Full raw response for preview
      redisKey: redisKey || null,
      fullPreview: true, // Indicates this is a preview, not saved
      message: 'Enrichment complete. Call /api/contacts/enrich/save to persist to database.',
    });
  } catch (error: any) {
    console.error('❌ Enrich contact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to enrich contact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
