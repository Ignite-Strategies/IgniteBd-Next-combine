import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/templates/phases
 * Get all Phase Templates
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const phaseTemplates = await prisma.phaseTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      phaseTemplates,
    });
  } catch (error) {
    console.error('❌ GetPhaseTemplates error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get phase templates',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

