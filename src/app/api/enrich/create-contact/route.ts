import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import type { NormalizedContactData } from '@/lib/apollo';

/**
 * POST /api/enrich/create-contact
 * 
 * CREATE CONTACT - Upserts enriched contact into CRM
 * This is called AFTER enrichment succeeds, when user chooses to save.
 * 
 * Body:
 * {
 *   "crmId": "xxxxx", // CompanyHQId (required)
 *   "enrichedProfile": { ... }, // Enriched data from /api/enrich/enrich
 *   "linkedinUrl": "https://linkedin.com/in/...", // Optional but recommended
 *   "email": "foo@bar.com" // Optional
 * }
 * 
 * Returns: Created/updated contact with contactId
 * Only creates after user intentionally chooses to save
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
    const { crmId, enrichedProfile, linkedinUrl, email } = body;

    // Validate inputs
    if (!crmId) {
      return NextResponse.json(
        { success: false, error: 'crmId (CompanyHQId) is required' },
        { status: 400 },
      );
    }

    if (!enrichedProfile) {
      return NextResponse.json(
        { success: false, error: 'enrichedProfile is required' },
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

    const enrichedData: NormalizedContactData = enrichedProfile;

    // Prepare upsert data from enriched fields
    const enrichedFields: any = {
      crmId,
      enrichmentSource: 'Apollo',
      enrichmentFetchedAt: new Date(),
      enrichmentPayload: enrichedData,
    };

    // Set linkedinUrl if provided
    if (linkedinUrl) {
      enrichedFields.linkedinUrl = linkedinUrl;
    } else if (enrichedData.linkedinUrl) {
      enrichedFields.linkedinUrl = enrichedData.linkedinUrl;
    }

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
    const enrichedEmail = enrichedData.email || email;
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

    // UPSERT contact using linkedinUrl OR email as the key
    // This person does NOT exist in CRM until now (user chose to save)
    let existingContact = null;

    // Try to find by linkedinUrl first (most reliable)
    if (enrichedFields.linkedinUrl) {
      existingContact = await prisma.contact.findFirst({
        where: {
          crmId,
          linkedinUrl: enrichedFields.linkedinUrl,
        },
      });
    }

    // If not found by linkedinUrl, try email
    if (!existingContact && enrichedEmail) {
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
      // Create new contact (user chose to save this person)
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
      contactId: contact.id,
    });
  } catch (error: any) {
    console.error('❌ Create contact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create contact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

