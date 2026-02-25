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
  try {
    // Log request for debugging
    console.log('📥 GET /api/contacts/by-email - Request received');
    
    // Optionally verify Firebase token (doesn't throw if missing)
    try {
      await optionallyVerifyFirebaseToken(request);
    } catch (authError) {
      // Log but don't fail - this endpoint allows unauthenticated access
      console.warn('⚠️ Auth verification failed (optional):', authError.message);
    }
    
    if (!request || !request.nextUrl) {
      throw new Error('Invalid request object');
    }
    
    const { searchParams } = request.nextUrl;
    const email = searchParams.get('email');
    const companyHQId = searchParams.get('companyHQId') || null;
    
    console.log('📧 Email from query:', email);

    if (!email) {
      return corsResponse(
        { success: false, error: 'email is required' },
        400,
        request,
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('🔍 Searching for contact with email:', normalizedEmail);
    
    // Use findFirst since email is not unique (it's part of email_crmId compound key)
    const contact = await prisma.contact.findFirst({
      where: {
        email: normalizedEmail,
      },
    });
    
    console.log('✅ Contact found (exact):', contact ? contact.id : 'null');

    if (contact) {
      return corsResponse(
        {
          success: true,
          fuzzy: false,
          contact: {
            id: contact.id,
            firstName: contact.firstName || null,
            lastName: contact.lastName || null,
            goesBy: contact.goesBy || null,
            email: contact.email,
            companyName: contact.companyName || null,
            title: contact.title || null,
            crmId: contact.crmId,
            contactCompanyId: contact.contactCompanyId || null,
          },
        },
        200,
        request,
      );
    }

    // --- Domain-based fallback ---
    // Extract domain from email (e.g. "citi.com" from "aashish.dhakad@citi.com")
    const emailDomain = normalizedEmail.split('@')[1] || null;

    if (emailDomain) {
      console.log('🔍 Falling back to domain search:', emailDomain, 'companyHQId:', companyHQId);

      const domainWhere = {
        OR: [
          { domain: emailDomain },
          { companyDomain: emailDomain },
        ],
      };

      // Narrow to the company HQ if provided
      if (companyHQId) {
        domainWhere.crmId = companyHQId;
      }

      const domainCandidates = await prisma.contact.findMany({
        where: domainWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          goesBy: true,
          email: true,
          companyName: true,
          title: true,
          crmId: true,
          contactCompanyId: true,
        },
        take: 10,
      });

      console.log('🔍 Domain candidates found:', domainCandidates.length);

      if (domainCandidates.length === 0) {
        return corsResponse(
          { success: false, error: 'Contact not found' },
          404,
          request,
        );
      }

      // Single candidate — return as a confident fuzzy match
      if (domainCandidates.length === 1) {
        return corsResponse(
          {
            success: true,
            fuzzy: true,
            contact: domainCandidates[0],
          },
          200,
          request,
        );
      }

      // Multiple candidates — return all so the UI can prompt the user to pick
      return corsResponse(
        {
          success: false,
          fuzzy: true,
          candidates: domainCandidates,
          error: 'Multiple contacts found at this domain — please select one',
        },
        200,
        request,
      );
    }

    return corsResponse(
      { success: false, error: 'Contact not found' },
      404,
      request,
    );
  } catch (error) {
    console.error('❌ GetContactByEmail error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Ensure we always return a CORS-enabled response, even on error
    try {
      return corsResponse(
        {
          success: false,
          error: 'Failed to get contact',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        500,
        request,
      );
    } catch (corsError) {
      // Fallback if CORS utility fails
      console.error('❌ CORS utility error:', corsError);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 },
      );
    }
  }
}

