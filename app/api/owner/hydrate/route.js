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

    // Find owner by firebaseId - get full owner object
    const owner = await prisma.owners.findUnique({
      where: { firebaseId },
      include: {
        company_hqs_company_hqs_ownerIdToowners: {
          take: 1,
          select: { id: true },
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

    // Get companyHQId from the relation
    const companyHQId = owner.company_hqs_company_hqs_ownerIdToowners?.[0]?.id || null;

    // Return the full owner object with companyHQId added
    const ownerWithCompanyHQId = {
      ...owner,
      companyHQId,
    };

    return NextResponse.json({
      success: true,
      message: 'Owner hydrated successfully',
      owner: ownerWithCompanyHQId,
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

