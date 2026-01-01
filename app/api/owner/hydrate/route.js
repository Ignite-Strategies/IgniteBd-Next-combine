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

    // Find owner by firebaseId - fetch whole object
    const owner = await prisma.owners.findUnique({
      where: { firebaseId },
      // No select - fetch all fields, we'll filter sensitive data before returning
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
    let memberships = await prisma.company_memberships.findMany({
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
        { createdAt: 'asc' },   // First by creation date
      ]
    });

    // Sort by role priority: OWNER first, then MANAGER, then others
    const getRolePriority = (role) => {
      const upperRole = (role || '').toUpperCase();
      if (upperRole === 'OWNER') return 1;
      if (upperRole === 'MANAGER') return 2;
      return 3;
    };
    memberships = memberships.sort((a, b) => {
      const priorityA = getRolePriority(a.role);
      const priorityB = getRolePriority(b.role);
      if (priorityA !== priorityB) {
        return priorityA - priorityB; // Lower priority number = higher in list
      }
      // Same priority, sort by createdAt (oldest first)
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    console.log(`✅ OWNER HYDRATE: Found ${memberships.length} membership(s) for owner ${owner.id}`);

    // 🔍 DEBUG: Log first membership to see what's actually loaded
    if (memberships.length > 0) {
      console.log('🔍 MEMBERSHIP DEBUG - First membership structure:');
      console.log('  - id:', memberships[0].id);
      console.log('  - companyHqId:', memberships[0].companyHqId);
      console.log('  - role:', memberships[0].role);
      console.log('  - has company_hqs:', !!memberships[0].company_hqs);
      console.log('  - company_hqs keys:', memberships[0].company_hqs ? Object.keys(memberships[0].company_hqs) : 'N/A');
      console.log('  - company_hqs.companyName:', memberships[0].company_hqs?.companyName);
      console.log('  - Full membership object:', JSON.stringify(memberships[0], null, 2));
    }

    // Get default CompanyHQ (first one after role-based sorting: OWNER > MANAGER > others)
    const defaultMembership = memberships[0];

    // Compute Microsoft connection status server-side (NO tokens sent to frontend)
    // Connection is valid if we have refresh token (can always refresh access token)
    // Access token expiration doesn't matter - we can refresh it automatically
    const microsoftConnected = !!(
      owner.microsoftAccessToken &&
      owner.microsoftRefreshToken
    );
    
    // Debug logging
    console.log('🔍 Microsoft Connection Check:');
    console.log(`  Has Access Token: ${!!owner.microsoftAccessToken}`);
    console.log(`  Has Refresh Token: ${!!owner.microsoftRefreshToken}`);
    console.log(`  Final Status: ${microsoftConnected ? '✅ CONNECTED' : '❌ NOT CONNECTED'}`);

    // Return owner with memberships (NO tokens - only safe data)
    // Destructure to exclude sensitive token fields
    const {
      microsoftAccessToken,
      microsoftRefreshToken,
      microsoftExpiresAt,
      microsoftTenantId,
      microsoftDisplayName,
      ...ownerSafe
    } = owner;

    const ownerWithMemberships = {
      ...ownerSafe,
      companyHQId: defaultMembership?.companyHqId || null,        // Default CompanyHQ (first after role sorting)
      companyHQ: defaultMembership?.company_hqs || null,          // Full CompanyHQ object
      memberships,        // Array of all memberships (sorted by role)
      // Microsoft connection state (computed server-side, no tokens)
      microsoftConnected,
      microsoftEmail: owner.microsoftEmail || null,
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
