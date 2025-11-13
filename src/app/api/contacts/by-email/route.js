import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { optionallyVerifyFirebaseToken } from '@/lib/firebaseAdmin';
import { handleCorsPreflight, corsResponse } from '@/lib/cors';

/**
 * OPTIONS /api/contacts/by-email
 * Handle CORS preflight requests
 */
export async function OPTIONS(request) {
  return handleCorsPreflight(request);
}

/**
 * GET /api/contacts/by-email
 * Get contact by email (for client portal login)
 * Query param: email (required)
 */
export async function GET(request) {
  await optionallyVerifyFirebaseToken(request);

  try {
    const { searchParams } = request.nextUrl;
    const email = searchParams.get('email');

    if (!email) {
      return corsResponse(
        { success: false, error: 'email is required' },
        400,
        request,
      );
    }

    const contact = await prisma.contact.findFirst({
      where: {
        email: email.toLowerCase().trim(),
      },
      include: {
        contactCompany: {
          select: {
            id: true,
            companyName: true,
          },
        },
        pipeline: {
          select: {
            pipeline: true,
            stage: true,
          },
        },
      },
    });

    if (!contact) {
      return corsResponse(
        { success: false, error: 'Contact not found' },
        404,
        request,
      );
    }

    return corsResponse(
      {
        success: true,
        contact: {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          crmId: contact.crmId,
          contactCompanyId: contact.contactCompanyId,
          contactCompany: contact.contactCompany,
          pipeline: contact.pipeline,
        },
      },
      200,
      request,
    );
  } catch (error) {
    console.error('❌ GetContactByEmail error:', error);
    return corsResponse(
      {
        success: false,
        error: 'Failed to get contact',
        details: error.message,
      },
      500,
      request,
    );
  }
}

