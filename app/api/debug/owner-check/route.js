import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/debug/owner-check
 * Debug route to check if current user has Owner record
 * Shows Firebase UID and Owner record status
 */
export async function GET(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get Owner by firebaseId
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      include: {
        managedCompanies: {
          select: { id: true, companyName: true },
        },
        ownedCompanies: {
          select: { id: true, companyName: true },
        },
        superAdmin: {
          select: { id: true, active: true },
        },
      },
    });

    // Also check if there are ANY owners with similar firebaseId (partial match)
    const allOwners = await prisma.owners.findMany({
      select: {
        id: true,
        firebaseId: true,
        email: true,
        name: true,
      },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      debug: {
        firebaseUser: {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.name,
        },
        owner: owner
          ? {
              id: owner.id,
              firebaseId: owner.firebaseId,
              email: owner.email,
              name: owner.name,
              hasManagedCompanies: owner.managedCompanies.length > 0,
              hasOwnedCompanies: owner.ownedCompanies.length > 0,
              managedCompanyIds: owner.managedCompanies.map((c) => c.id),
              ownedCompanyIds: owner.ownedCompanies.map((c) => c.id),
              isSuperAdmin: !!owner.superAdmin, // If SuperAdmin record exists, they're active
            }
          : null,
        ownerFound: !!owner,
        allOwnersInDb: allOwners,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 },
    );
  }
}

