import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * POST /api/contacts/create
 * Simple upsert by email - name and email only
 * 
 * Body:
 * - crmId (required) - CompanyHQId
 * - firstName (required)
 * - lastName (required)
 * - email (required) - used for upsert
 * 
 * Returns:
 * - contact: Created or updated contact
 */
export async function POST(request) {
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
    
    // Get companyHQId from request body (frontend should send this from localStorage)
    const crmId = body.crmId;
    if (!crmId) {
      return NextResponse.json(
        { success: false, error: 'crmId (companyHQId) is required in request body' },
        { status: 400 },
      );
    }

    // Validate crmId format - should not be a company name
    if (crmId.includes(' ') || crmId.toLowerCase() === crmId && crmId.includes('-') && !crmId.match(/^[a-f0-9-]{36}$/i) && !crmId.match(/^[a-z0-9-]+$/)) {
      console.warn(`⚠️ Suspicious crmId format: ${crmId}. This might be a company name instead of an ID.`);
    }

    // Get owner from Firebase user
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

    // CRITICAL: Membership guard - verify owner has access to this CompanyHQ
    // This prevents creating contacts in companyHQs the user doesn't belong to
    const { membership } = await resolveMembership(owner.id, crmId);
    if (!membership) {
      console.error(`❌ ACCESS DENIED: Owner ${owner.id} attempted to create contact in CompanyHQ ${crmId} without membership`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden: No membership in this CompanyHQ. Please switch to a CompanyHQ you have access to.',
          details: {
            requestedCompanyHQId: crmId,
            ownerId: owner.id,
          },
        },
        { status: 403 },
      );
    }

    // Verify the CompanyHQ actually exists
    const companyHQ = await prisma.company_hqs.findUnique({
      where: { id: crmId },
      select: { id: true, companyName: true },
    });

    if (!companyHQ) {
      console.error(`❌ CompanyHQ not found: ${crmId}`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'CompanyHQ not found. The companyHQId may be incorrect.',
          details: { requestedCompanyHQId: crmId },
        },
        { status: 404 },
      );
    }

    console.log(`✅ Membership verified: Owner ${owner.id} has ${membership.role} role in CompanyHQ ${crmId} (${companyHQ.companyName})`);
    const { firstName, lastName, email } = body;

    // Validate required fields
    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: 'firstName and lastName are required' },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'email is required' },
        { status: 400 },
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if contact already exists
    const existingContact = await prisma.contact.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    // Contacts are global - if exists, just update name fields
    // Don't block cross-CompanyHQ - multiple people can know the same contact
    const now = new Date();
    let contact;
    
    if (existingContact) {
      // Contact exists globally - update name fields (but keep original crmId)
      // This allows multiple CompanyHQs to work with the same contact
      contact = await prisma.contact.update({
        where: {
          email: normalizedEmail,
        },
        data: {
          firstName,
          lastName,
          updatedAt: now,
          // Note: We keep the original crmId - the contact "belongs" to the first CompanyHQ that created it
          // But this doesn't prevent other CompanyHQs from enriching/working with them
        },
      });
      console.log(`ℹ️ Contact ${normalizedEmail} already exists in CompanyHQ ${existingContact.crmId}, updating name fields for CompanyHQ ${crmId} context`);
    } else {
      // Create new contact
      contact = await prisma.contact.create({
        data: {
          crmId,
          firstName,
          lastName,
          email: normalizedEmail,
          updatedAt: now,
        },
      });
    }

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    console.error('❌ CreateContact error:', error);
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
