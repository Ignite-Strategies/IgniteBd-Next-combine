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
    // Get owner from Firebase user
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      include: {
        company_hqs_company_hqs_ownerIdToowners: {
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Get companyHQId from owner
    const crmId = owner.company_hqs_company_hqs_ownerIdToowners?.[0]?.id;
    if (!crmId) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found for owner' },
        { status: 404 },
      );
    }

    // Membership guard
    const { membership } = await resolveMembership(owner.id, crmId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 },
      );
    }

    const body = await request.json();
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
