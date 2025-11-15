import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { enrichContact, type NormalizedContactData } from '@/lib/apollo';

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

    // Enrich contact using Apollo
    let enrichedData: NormalizedContactData;
    try {
      enrichedData = await enrichContact(email, linkedinUrl);
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

    // Merge only defined Apollo fields into Contact
    // Only update fields that have values (don't overwrite with undefined)
    const updateData: any = {
      enrichmentSource: 'Apollo',
      enrichmentFetchedAt: new Date(),
      enrichmentPayload: enrichedData,
    };

    // Only set fields that are defined in enrichedData
    if (enrichedData.fullName !== undefined) updateData.fullName = enrichedData.fullName;
    if (enrichedData.firstName !== undefined) updateData.firstName = enrichedData.firstName;
    if (enrichedData.lastName !== undefined) updateData.lastName = enrichedData.lastName;
    if (enrichedData.title !== undefined) updateData.title = enrichedData.title;
    if (enrichedData.seniority !== undefined) updateData.seniority = enrichedData.seniority;
    if (enrichedData.department !== undefined) updateData.department = enrichedData.department;
    if (enrichedData.linkedinUrl !== undefined) updateData.linkedinUrl = enrichedData.linkedinUrl;
    if (enrichedData.phone !== undefined) updateData.phone = enrichedData.phone;
    if (enrichedData.city !== undefined) updateData.city = enrichedData.city;
    if (enrichedData.state !== undefined) updateData.state = enrichedData.state;
    if (enrichedData.country !== undefined) updateData.country = enrichedData.country;
    if (enrichedData.companyName !== undefined) updateData.companyName = enrichedData.companyName;
    if (enrichedData.companyDomain !== undefined) updateData.companyDomain = enrichedData.companyDomain;

    // Also update email if we have it and it's different (normalize case)
    // Use email from enriched data if available (from LinkedIn enrichment), otherwise use provided email
    const enrichedEmail = enrichedData.email || email;
    if (enrichedEmail && enrichedEmail.toLowerCase() !== existingContact.email?.toLowerCase()) {
      updateData.email = enrichedEmail.toLowerCase();
    }

    // Update domain if we have a company domain
    if (enrichedData.companyDomain && !updateData.domain) {
      updateData.domain = enrichedData.companyDomain;
    } else if (enrichedEmail && enrichedEmail.includes('@') && !updateData.domain && !existingContact.domain) {
      // Fallback: extract domain from email if no company domain
      const emailDomain = enrichedEmail.split('@')[1];
      if (emailDomain) {
        updateData.domain = emailDomain.toLowerCase();
      }
    }

    // Save changes via Prisma
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
      include: {
        contactCompany: true,
        contactList: true,
        pipeline: true,
      },
    });

    return NextResponse.json({
      success: true,
      contact: updatedContact,
      enrichedData,
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
