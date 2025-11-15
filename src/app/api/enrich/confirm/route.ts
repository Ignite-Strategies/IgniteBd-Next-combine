import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { enrichPerson, normalizeApolloResponse, type NormalizedContactData } from '@/lib/apollo';

/**
 * POST /api/enrich/confirm
 * 
 * EXTERNAL CONFIRM + ENRICH + UPSERT
 * This route enriches a contact using Apollo and upserts it into the database.
 * 
 * Flow:
 * 1. Call Apollo enrichment using LinkedIn URL
 * 2. Normalize the enriched fields
 * 3. UPSERT the contact based on linkedinUrl OR email
 * 4. Return the enriched contact (with contactId)
 * 
 * Important:
 * - We ONLY create/modify a contact AFTER enrichment succeeds
 * - No partial contacts. No contactId required before enrichment.
 * 
 * Body:
 * {
 *   "crmId": "xxxxx", // CompanyHQId (required)
 *   "linkedinUrl": "https://linkedin.com/in/...", // Required
 *   "preview": { ... } // Optional - preview data from /api/enrich/preview
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
    const { crmId, linkedinUrl } = body;

    // Validate inputs
    if (!crmId) {
      return NextResponse.json(
        { success: false, error: 'crmId (CompanyHQId) is required' },
        { status: 400 },
      );
    }

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

    // Verify CompanyHQ exists
    const companyHQ = await prisma.companyHQ.findUnique({
      where: { id: crmId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    // Step 1: Call Apollo ENRICHMENT using ONLY linkedinUrl (do NOT use email)
    // This person is NOT a CRM contact yet - they don't exist in our database
    let enrichedData: NormalizedContactData;
    try {
      // ONLY enrich by linkedinUrl - do NOT use email from preview (it's fake/placeholder)
      const apolloResponse = await enrichPerson({ linkedinUrl });
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

    // Step 2: Use ONLY enriched data from Apollo (real data, not preview placeholders)
    const enrichedEmail = enrichedData.email; // Use only real email from enrichment, ignore preview
    
    // Prepare upsert data from enriched fields
    const enrichedFields: any = {
      crmId,
      linkedinUrl: linkedinUrl, // Always use the provided linkedinUrl
      enrichmentSource: 'Apollo',
      enrichmentFetchedAt: new Date(),
      enrichmentPayload: enrichedData,
    };

    // Set enriched fields (only if defined)
    if (enrichedData.fullName !== undefined) enrichedFields.fullName = enrichedData.fullName;
    if (enrichedData.firstName !== undefined) enrichedFields.firstName = enrichedData.firstName;
    if (enrichedData.lastName !== undefined) enrichedFields.lastName = enrichedData.lastName;
    if (enrichedData.title !== undefined) enrichedFields.title = enrichedData.title;
    if (enrichedData.seniority !== undefined) enrichedFields.seniority = enrichedData.seniority;
    if (enrichedData.department !== undefined) enrichedFields.department = enrichedData.department;
    if (enrichedData.phone !== undefined) enrichedFields.phone = enrichedData.phone;
    if (enrichedData.city !== undefined) enrichedFields.city = enrichedData.city;
    if (enrichedData.state !== undefined) enrichedFields.state = enrichedData.state;
    if (enrichedData.country !== undefined) enrichedFields.country = enrichedData.country;
    if (enrichedData.companyName !== undefined) enrichedFields.companyName = enrichedData.companyName;
    if (enrichedData.companyDomain !== undefined) enrichedFields.companyDomain = enrichedData.companyDomain;

    // Set email if available from enriched data (normalize to lowercase)
    if (enrichedEmail) {
      enrichedFields.email = enrichedEmail.toLowerCase();
      // Extract domain from email if no company domain
      if (!enrichedFields.companyDomain && enrichedEmail.includes('@')) {
        const emailDomain = enrichedEmail.split('@')[1];
        if (emailDomain) {
          enrichedFields.domain = emailDomain.toLowerCase();
        }
      }
    } else if (enrichedData.companyDomain) {
      enrichedFields.domain = enrichedData.companyDomain;
    }

    // Step 3: UPSERT contact AFTER enrichment succeeds
    // Use linkedinUrl + crmId to find existing contact (this person does NOT exist in CRM until now)
    const existingContact = await prisma.contact.findFirst({
      where: {
        crmId,
        linkedinUrl: linkedinUrl,
      },
    });

    let contact;
    if (existingContact) {
      // Update existing contact
      contact = await prisma.contact.update({
        where: { id: existingContact.id },
        data: enrichedFields,
        include: {
          contactCompany: true,
          contactList: true,
          pipeline: true,
        },
      });
      console.log(`✅ Contact updated via enrichment: ${contact.id}`);
    } else {
      // Create new contact (this person did NOT exist in CRM before)
      contact = await prisma.contact.create({
        data: enrichedFields,
        include: {
          contactCompany: true,
          contactList: true,
          pipeline: true,
        },
      });
      console.log(`✅ Contact created via enrichment: ${contact.id}`);
    }

    return NextResponse.json({
      success: true,
      contact,
      enrichedData,
    });
  } catch (error: any) {
    console.error('❌ Confirm enrichment error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to confirm and enrich contact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

