import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';
import { extractIndustry, inferCompanySize, extractPositionType } from '@/lib/utils/contactExtraction';
import type { NormalizedContactData } from '@/lib/apollo';

/**
 * POST /api/contacts/linkedin/save
 * 
 * Simple save route for LinkedIn contacts
 * Saves contact with basic info + simple company metadata
 * NO Company record creation
 * NO intelligence scoring
 * Just: name, email, title, company metadata
 */
export async function POST(request: Request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { 
      crmId, 
      firstName, 
      lastName, 
      email, 
      phone, 
      title, 
      linkedinUrl,
      enrichedProfile, // NormalizedContactData from Apollo
      rawApolloResponse, // Full Apollo response for extraction
    } = body;

    // Validate required fields (email is optional — save with name + LinkedIn URL when Apollo doesn't return email)
    if (!crmId) {
      return NextResponse.json(
        { success: false, error: 'crmId (companyHQId) is required' },
        { status: 400 },
      );
    }

    // Get owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Verify membership
    const { membership } = await resolveMembership(owner.id, crmId);
    if (!membership) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden: No membership in this CompanyHQ',
        },
        { status: 403 },
      );
    }

    // Verify CompanyHQ exists
    const companyHQ = await prisma.company_hqs.findUnique({
      where: { id: crmId },
      select: { id: true, companyName: true },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    // Extract simple company metadata
    const apolloData = rawApolloResponse || enrichedProfile;
    const companyName = enrichedProfile?.companyName || apolloData?.person?.organization?.name || null;
    const companyIndustry = extractIndustry(apolloData);
    const companySize = inferCompanySize(apolloData);
    const positionType = extractPositionType(title);

    const normalizedEmail = email ? (email as string).toLowerCase().trim() : null;

    const contactData: any = {
      firstName: firstName || null,
      lastName: lastName || null,
      email: normalizedEmail,
      phone: phone || null,
      title: title || null,
      linkedinUrl: linkedinUrl || null,
      companyName: companyName,
      companyIndustry: companyIndustry,
      companySize: companySize,
      positionType: positionType,
      enrichmentSource: 'Apollo',
      enrichmentFetchedAt: new Date(),
      enrichmentPayload: rawApolloResponse ? JSON.stringify(rawApolloResponse) : null,
    };

    let existingContact: { id: string } | null = null;

    if (normalizedEmail) {
      existingContact = await prisma.contact.findUnique({
        where: {
          email_crmId: {
            email: normalizedEmail,
            crmId: crmId,
          },
        },
        select: { id: true },
      });
    } else if (linkedinUrl) {
      existingContact = await prisma.contact.findFirst({
        where: {
          crmId,
          linkedinUrl: linkedinUrl,
        },
        select: { id: true },
      });
    }

    let contact;
    if (existingContact) {
      contact = await prisma.contact.update({
        where: { id: existingContact.id },
        data: contactData,
      });
      console.log(`✅ Updated existing contact ${normalizedEmail || linkedinUrl} in CompanyHQ ${crmId}`);
    } else {
      contact = await prisma.contact.create({
        data: {
          ...contactData,
          crmId,
          ownerId: owner.id,
        },
      });
      console.log(`✅ Created new contact ${normalizedEmail || linkedinUrl} in CompanyHQ ${crmId}`);
    }

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error: any) {
    console.error('❌ LinkedIn save error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save contact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

