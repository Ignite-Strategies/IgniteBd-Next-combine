import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/companyhq/get
 * 
 * Get CompanyHQ by ID
 * 
 * Payload:
 * {
 *   companyHQId: string (required)
 * }
 */
export async function POST(request) {
  try {
    // Verify Firebase token
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { companyHQId } = body;

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const companyHQ = await prisma.companyHQ.findUnique({
      where: { id: companyHQId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contactOwner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      companyHQ,
    });
  } catch (error) {
    console.error('❌ Get CompanyHQ error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch CompanyHQ',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

