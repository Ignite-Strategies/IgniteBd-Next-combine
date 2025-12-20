/**
 * NOTE:
 * Owner hydration happens once during app boot.
 * Feature routes and OAuth flows MUST NOT hydrate.
 * OAuth returns tokens only. Save routes attach them.
 * 
 * This route is for app bootstrap/welcome flow ONLY.
 * Do NOT call from feature pages, OAuth callbacks, or token save routes.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function GET(request) {
  try {
    // Log token for debugging
    const authHeader = request.headers.get('authorization');
    console.log('🔥 HYDRATE: Token received:', authHeader ? `${authHeader.substring(0, 30)}...` : 'NO TOKEN');

    let firebaseUser;
    try {
      firebaseUser = await verifyFirebaseToken(request);
    } catch (error) {
      console.error('❌ HYDRATE: Token verification failed:', error.message);
      return NextResponse.json(
        { success: false, error: 'Firebase authentication required' },
        { status: 401 },
      );
    }

    const firebaseId = firebaseUser.uid;

    console.log('🚀 OWNER HYDRATE: Finding Owner by Firebase ID:', firebaseId);

    // Find owner by firebaseId
    const owner = await prisma.owners.findUnique({
      where: { firebaseId },
      select: {
        id: true,
        firebaseId: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        photoURL: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!owner) {
      console.log('❌ OWNER HYDRATE: No Owner found for Firebase ID:', firebaseId);
      return NextResponse.json(
        {
          success: false,
          error: 'Owner not found',
          message: 'No Owner found for this Firebase ID. Please sign up first.',
          code: 'OWNER_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    // Get ALL memberships for this owner
    const memberships = await prisma.company_memberships.findMany({
      where: { userId: owner.id },
      include: {
        company_hqs: {
          select: {
            id: true,
            companyName: true,
            companyWebsite: true,
            companyIndustry: true,
          }
        }
      },
      orderBy: [
        { isPrimary: 'desc' }, // Primary first
        { createdAt: 'asc' },   // Then by oldest
      ]
    });

    console.log(`✅ OWNER HYDRATE: Found ${memberships.length} membership(s) for owner ${owner.id}`);

    // Get primary/default CompanyHQ
    const primaryMembership = memberships.find(m => m.isPrimary) || memberships[0];
    const companyHQId = primaryMembership?.companyHqId || null;
    const companyHQ = primaryMembership?.company_hqs || null;

    // Return owner with memberships
    const ownerWithMemberships = {
      ...owner,
      companyHQId,        // Default/primary CompanyHQ
      companyHQ,          // Full CompanyHQ object
      memberships,        // Array of all memberships
    };

    return NextResponse.json({
      success: true,
      message: 'Owner hydrated successfully',
      owner: ownerWithMemberships,
      memberships,        // Also return at top level for easy access
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ OWNER HYDRATE: Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Database error',
        message: error.message,
      },
      { status: 500 },
    );
  }
}

