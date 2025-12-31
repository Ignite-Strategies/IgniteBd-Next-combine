import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/platform-access/company/:companyId
 * 
 * Get all platform access records for a company.
 */
export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { companyId } = params;

    const accesses = await prisma.platform_accesses.findMany({
      where: { companyId },
      include: {
        plans: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      accesses,
    });
  } catch (error) {
    console.error('❌ Error fetching company platform access:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch company platform access' },
      { status: 500 },
    );
  }
}

