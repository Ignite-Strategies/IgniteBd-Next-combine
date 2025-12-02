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

    const owner = await prisma.owner.findUnique({
      where: { firebaseId },
      include: {
        ownedCompanies: {
          include: {
            owner: true,
            manager: true,
            contacts: {
              take: 5,
              orderBy: { createdAt: 'desc' },
            },
            contactLists: {
              take: 5,
            },
          },
        },
        managedCompanies: {
          include: {
            owner: true,
            manager: true,
          },
        },
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

    // Check if Owner is SuperAdmin
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { ownerId: owner.id },
    });

    const isSuperAdmin = superAdmin?.active === true;

    const primaryCompanyHQ = owner.ownedCompanies?.[0] || null;

    const hydratedOwner = {
      id: owner.id,
      firebaseId: owner.firebaseId,
      name: owner.name,
      email: owner.email,
      photoURL: owner.photoURL,
      companyHQId: primaryCompanyHQ?.id || null,
      companyHQ: primaryCompanyHQ || null,
      ownedCompanies: owner.ownedCompanies || [],
      managedCompanies: owner.managedCompanies || [],
      createdAt: owner.createdAt,
      updatedAt: owner.updatedAt,
    };

    return NextResponse.json({
      success: true,
      message: 'Owner hydrated successfully',
      owner: hydratedOwner,
      isSuperAdmin: isSuperAdmin,
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

