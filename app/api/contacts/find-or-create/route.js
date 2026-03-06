import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/contacts/find-or-create
 *
 * Atomic server-side upsert: finds a contact by email within a company, or creates one.
 * Single round-trip — replaces the fragile 3-call client-side dance:
 *   find → create → update name
 *
 * Body: {
 *   email:       string  (required)
 *   companyHQId: string  (required)
 *   firstName?:  string
 *   lastName?:   string
 *   companyName?: string
 *   title?:      string
 * }
 *
 * Returns: { success, contact, created: boolean }
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email, companyHQId, firstName, lastName, companyName, title } = body ?? {};

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 });
    }
    if (!companyHQId) {
      return NextResponse.json({ success: false, error: 'companyHQId is required' }, { status: 400 });
    }

    // Verify company exists
    const company = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
      select: { id: true, ownerId: true },
    });
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Try to find existing contact first
    const existing = await prisma.contact.findFirst({
      where: {
        crmId: companyHQId,
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        title: true, companyName: true, lastEngagementDate: true,
        lastEngagementType: true, nextEngagementDate: true,
      },
    });

    if (existing) {
      // Backfill any missing name/company/title fields if provided
      const updates = {};
      if (!existing.firstName && firstName) updates.firstName = firstName;
      if (!existing.lastName && lastName) updates.lastName = lastName;
      if (!existing.companyName && companyName) updates.companyName = companyName;
      if (!existing.title && title) updates.title = title;

      const contact = Object.keys(updates).length
        ? await prisma.contact.update({ where: { id: existing.id }, data: updates,
            select: { id: true, firstName: true, lastName: true, email: true, title: true, companyName: true } })
        : existing;

      return NextResponse.json({ success: true, contact, created: false });
    }

    // Create new contact
    const contact = await prisma.contact.create({
      data: {
        crmId: companyHQId,
        email: normalizedEmail,
        firstName: firstName || null,
        lastName: lastName || null,
        companyName: companyName || null,
        title: title || null,
      },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        title: true, companyName: true,
      },
    });

    console.log(`✅ find-or-create: created new contact ${contact.id} (${normalizedEmail})`);
    return NextResponse.json({ success: true, contact, created: true });
  } catch (error) {
    console.error('❌ find-or-create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to find or create contact', details: error.message },
      { status: 500 },
    );
  }
}
