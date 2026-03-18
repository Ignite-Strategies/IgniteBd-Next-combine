import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { enrichPerson, normalizeApolloResponse } from '@/lib/apollo';

/**
 * POST /api/contacts/[contactId]/get-email
 *
 * Single-purpose: call Apollo with the contact's LinkedIn URL and save the
 * returned email (and optionally name/title) on the contact.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { contactId } = await params;
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    if (!contact.linkedinUrl) {
      return NextResponse.json(
        { success: false, error: 'Contact has no LinkedIn URL. Add a LinkedIn URL to fetch email.' },
        { status: 400 },
      );
    }

    const apolloResponse = await enrichPerson({
      linkedinUrl: contact.linkedinUrl,
    });
    const normalized = normalizeApolloResponse(apolloResponse);

    if (!normalized.email) {
      return NextResponse.json(
        {
          success: true,
          email: null,
          message: 'Apollo did not return an email for this profile.',
          contact,
        },
        { status: 200 },
      );
    }

    const updateData: Record<string, string> = { email: normalized.email };
    if (normalized.firstName && !contact.firstName) {
      updateData.firstName = normalized.firstName;
    }
    if (normalized.lastName && !contact.lastName) {
      updateData.lastName = normalized.lastName;
    }
    if (normalized.fullName && !contact.fullName) {
      updateData.fullName = normalized.fullName;
    }
    if (normalized.title && !contact.title) {
      updateData.title = normalized.title;
    }

    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      email: normalized.email,
      contact: updatedContact,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get email';
    console.error('❌ Get email error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Get email failed',
        details: message,
      },
      { status: 500 },
    );
  }
}
