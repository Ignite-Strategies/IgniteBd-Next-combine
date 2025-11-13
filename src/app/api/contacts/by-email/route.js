import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { optionallyVerifyFirebaseToken } from '@/lib/firebaseAdmin';

// CORS headers for client portal
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://clientportal.ignitegrowth.biz',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * OPTIONS /api/contacts/by-email
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
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
      return NextResponse.json(
        { success: false, error: 'email is required' },
        { status: 400, headers: corsHeaders },
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
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404, headers: corsHeaders },
      );
    }

    return NextResponse.json(
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
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('❌ GetContactByEmail error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get contact',
        details: error.message,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}

