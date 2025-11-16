import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/templates/deliverables
 * Get all Deliverable Templates
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
    const deliverableTemplates = await prisma.deliverableTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      deliverableTemplates,
    });
  } catch (error) {
    console.error('❌ GetDeliverableTemplates error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get deliverable templates',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

