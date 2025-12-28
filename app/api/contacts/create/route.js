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

    // Membership guard - verify owner has access to this CompanyHQ
    const { membership } = await resolveMembership(owner.id, crmId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 },
      );
    }
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

    // If contact exists but belongs to different companyHQ, return error
    if (existingContact && existingContact.crmId !== crmId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Contact already exists in a different company. Cannot update across company boundaries.',
          details: {
            existingCrmId: existingContact.crmId,
            requestedCrmId: crmId,
          },
        },
        { status: 409 },
      );
    }

    // Upsert by email
    const now = new Date();
    const contact = await prisma.contact.upsert({
      where: {
        email: normalizedEmail,
      },
      update: {
        firstName,
        lastName,
        updatedAt: now,
        // Don't update crmId - it's a tenant identifier and shouldn't change
      },
      create: {
        crmId,
        firstName,
        lastName,
        email: normalizedEmail,
        updatedAt: now,
      },
    });

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
