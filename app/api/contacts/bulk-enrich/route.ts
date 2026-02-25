import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { enrichPerson } from '@/lib/apollo';

/**
 * POST /api/contacts/bulk-enrich
 * 
 * Bulk enrich a single contact by LinkedIn URL
 * Primary goal: Get email address
 * Safe error handling: Still saves contact even if no email found
 * 
 * Body:
 * {
 *   "contactId": "uuid",
 *   "linkedinUrl": "https://linkedin.com/in/...",
 *   "companyHQId": "uuid"
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
    const { contactId, linkedinUrl, companyHQId } = body;

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

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

    // Get contact (need crmId for company-scoped email uniqueness)
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        crmId: true,
        email: true,
        linkedinUrl: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Enrich from Apollo using LinkedIn URL
    let apolloResponse: any = null;
    let enrichedEmail: string | null = null;
    let enrichmentPayload: string | null = null;

    try {
      console.log(`🔍 Bulk enriching contact ${contactId} via LinkedIn URL: ${linkedinUrl}`);
      
      apolloResponse = await enrichPerson({ linkedinUrl });
      
      // Extract email from Apollo response
      if (apolloResponse?.person?.email) {
        enrichedEmail = apolloResponse.person.email;
        console.log(`✅ Found email from Apollo: ${enrichedEmail}`);
      } else {
        console.warn(`⚠️ No email found in Apollo response for LinkedIn URL: ${linkedinUrl}`);
      }

      // Store raw Apollo response as JSON
      if (apolloResponse) {
        enrichmentPayload = JSON.stringify(apolloResponse);
      }
    } catch (error: any) {
      // Don't fail the whole request if Apollo enrichment fails
      // Just log it and continue - we'll still update the contact
      console.error('❌ Apollo enrichment error (non-fatal):', error.message);
      console.error('Error details:', {
        contactId,
        linkedinUrl,
        error: error.message,
      });
    }

    // Update contact with email if found, and LinkedIn URL
    // Safe error handling: Still save even if no email
    const updateData: any = {
      linkedinUrl: linkedinUrl,
      enrichmentSource: apolloResponse ? 'Apollo' : null,
      enrichmentPayload: enrichmentPayload,
    };

    // Company-scoped: emails must be unique per crmId. Check if another contact already has this email.
    let emailAlreadyExists = false;
    if (enrichedEmail && !contact.email) {
      const existingWithEmail = await prisma.contact.findFirst({
        where: {
          crmId: contact.crmId,
          email: enrichedEmail.toLowerCase().trim(),
          id: { not: contactId },
        },
        select: { id: true },
      });
      if (existingWithEmail) {
        emailAlreadyExists = true;
        console.warn(`⚠️ Email ${enrichedEmail} already exists for another contact in this company - skipping to avoid duplicate`);
      } else {
        updateData.email = enrichedEmail;
        console.log(`✅ Updating contact ${contactId} with email: ${enrichedEmail}`);
      }
    } else if (enrichedEmail && contact.email) {
      console.log(`ℹ️ Contact ${contactId} already has email, keeping existing: ${contact.email}`);
    } else {
      console.log(`ℹ️ No email found for contact ${contactId}, saving without email`);
    }

    // Update contact - safe to do even if no email
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
      select: {
        id: true,
        email: true,
        linkedinUrl: true,
        firstName: true,
        lastName: true,
      },
    });

    return NextResponse.json({
      success: true,
      contact: updatedContact,
      emailFound: !!enrichedEmail && !emailAlreadyExists,
      email: emailAlreadyExists ? null : (enrichedEmail || null),
      emailAlreadyExists: emailAlreadyExists,
      message: emailAlreadyExists
        ? `Email ${enrichedEmail} already exists for another contact in this company (possible duplicate).`
        : enrichedEmail
          ? `Successfully enriched contact. Email: ${enrichedEmail}`
          : 'Contact updated. No email found in Apollo response.',
    });
  } catch (error: any) {
    console.error('❌ Bulk enrich error:', error);
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
