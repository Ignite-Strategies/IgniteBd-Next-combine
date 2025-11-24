import { NextResponse } from 'next/server';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { enrichPerson, normalizeApolloResponse, type NormalizedContactData } from '@/lib/apollo';
import { storeEnrichedContact } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/enrich/enrich
 * 
 * EXTERNAL ENRICHMENT - Deep enrichment via Apollo
 * This does NOT write to the database. It stores enriched data in Redis.
 * 
 * Body:
 * {
 *   "linkedinUrl": "https://linkedin.com/in/..." (required)
 * }
 * 
 * Returns: Enriched profile data + Redis key
 * Does NOT touch the database
 * Does NOT create or update contacts
 * Just stores in Redis and lets it chill
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
    const { linkedinUrl, autoSave = false, companyHQId } = body;

    // For LinkedIn-only flow, require linkedinUrl
    if (!linkedinUrl) {
      return NextResponse.json(
        { success: false, error: 'linkedinUrl is required' },
        { status: 400 },
      );
    }

    if (!linkedinUrl.includes('linkedin.com')) {
      return NextResponse.json(
        { success: false, error: 'Valid LinkedIn URL is required' },
        { status: 400 },
      );
    }

    // Call Apollo ENRICHMENT using /people/enrich (deep lookup)
    // This person is NOT a CRM contact yet - they don't exist in our database
    // Just enrich and store in Redis - NO database writes, NO upserting
    let enrichedData: NormalizedContactData;
    let rawApolloResponse: any;
    try {
      console.log('🔍 Enriching LinkedIn profile:', linkedinUrl);
      // Enrich by linkedinUrl only
      const apolloResponse = await enrichPerson({ linkedinUrl });
      rawApolloResponse = apolloResponse; // Store raw response
      enrichedData = normalizeApolloResponse(apolloResponse);
      console.log('✅ Enrichment successful');
    } catch (error: any) {
      console.error('❌ Apollo enrichment error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        linkedinUrl,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Enrichment failed',
          details: error.message || 'Failed to enrich contact from Apollo',
        },
        { status: 500 },
      );
    }

    // Store enriched data in Redis
    let redisKey = '';
    try {
      redisKey = await storeEnrichedContact(linkedinUrl, {
        enrichedProfile: enrichedData,
        rawApolloResponse: rawApolloResponse,
      });
      console.log('✅ Enriched data stored in Redis:', redisKey);
    } catch (redisError: any) {
      // Don't fail if Redis fails - just log it
      console.warn('⚠️ Redis store failed (non-critical):', redisError.message);
    }

    // Optionally save to database if autoSave is true
    let savedContact = null;
    if (autoSave && companyHQId && enrichedData.email) {
      try {
        // Get companyHQ for tenant context
        const companyHQ = await prisma.companyHQ.findUnique({
          where: { id: companyHQId },
        });

        if (!companyHQ) {
          console.warn('⚠️ CompanyHQ not found, skipping DB save');
        } else {
          // Upsert contact by email
          savedContact = await prisma.contact.upsert({
            where: {
              email: enrichedData.email.toLowerCase().trim(),
            },
            update: {
              firstName: enrichedData.firstName || undefined,
              lastName: enrichedData.lastName || undefined,
              title: enrichedData.title || undefined,
              phone: enrichedData.phone || undefined,
              linkedinUrl: linkedinUrl || undefined,
              enrichmentSource: 'Apollo',
              enrichmentFetchedAt: new Date(),
              enrichmentPayload: rawApolloResponse || undefined,
            },
            create: {
              crmId: companyHQId,
              email: enrichedData.email.toLowerCase().trim(),
              firstName: enrichedData.firstName || null,
              lastName: enrichedData.lastName || null,
              title: enrichedData.title || null,
              phone: enrichedData.phone || null,
              linkedinUrl: linkedinUrl || null,
              enrichmentSource: 'Apollo',
              enrichmentFetchedAt: new Date(),
              enrichmentPayload: rawApolloResponse || null,
            },
            include: {
              contactCompany: true,
            },
          });
          console.log('✅ Contact saved to database:', savedContact.id);
        }
      } catch (dbError: any) {
        console.error('❌ Failed to save contact to database:', dbError);
        // Don't fail the enrichment request - just log the error
      }
    }

    // Return enriched data + raw Apollo response + Redis key + saved contact (if any)
    return NextResponse.json({
      success: true,
      enrichedProfile: enrichedData,
      rawApolloResponse: rawApolloResponse, // Include full raw response
      redisKey: redisKey || null, // Redis key where data is stored
      contact: savedContact, // Contact saved to DB (if autoSave was true)
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

