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
    const { crmId, linkedinUrl, preview } = body;

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

    // Call Apollo ENRICHMENT using /people/enrich (deep lookup)
    let enrichedData: NormalizedContactData;
    try {
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

    // Use email from enriched data, or fall back to preview email
    const enrichedEmail = enrichedData.email || preview?.email;
    
    // Prepare upsert data from enriched fields
    const enrichedFields: any = {
      crmId,
      linkedinUrl: enrichedData.linkedinUrl || linkedinUrl,
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

    // Set email if available (normalize to lowercase)
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

    // UPSERT contact based on linkedinUrl OR email
    // First, try to find existing contact by linkedinUrl or email
    let existingContact = null;
    
    if (linkedinUrl) {
      existingContact = await prisma.contact.findFirst({
        where: {
          crmId,
          OR: [
            { linkedinUrl: linkedinUrl },
            ...(enrichedEmail ? [{ email: enrichedEmail.toLowerCase() }] : []),
          ],
        },
      });
    } else if (enrichedEmail) {
      existingContact = await prisma.contact.findFirst({
        where: {
          crmId,
          email: enrichedEmail.toLowerCase(),
        },
      });
    }

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
      // Create new contact
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

