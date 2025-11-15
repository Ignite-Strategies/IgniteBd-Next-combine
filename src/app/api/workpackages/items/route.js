import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * WorkPackageItem Route
 * Items attach artifact IDs (blogIds, personaIds, etc.)
 * Artifacts are created via their own builders/routes
 */

/**
 * POST /api/workpackages/items
 * Create WorkPackageItem (CONFIG ONLY - no generation)
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      workPackageId,
      type,
      label,
      quantity = 1,
    } = body ?? {};

    if (!workPackageId || !type || !label) {
      return NextResponse.json(
        { success: false, error: 'workPackageId, type, and label are required' },
        { status: 400 },
      );
    }

    // Create WorkPackageItem - CONFIG ONLY, no generation
    const item = await prisma.workPackageItem.create({
      data: {
        workPackageId,
        type,
        label,
        quantity,
        status: 'TODO',
        clientArtifactId: null, // Will be set when user clicks "Generate"
      },
    });

    console.log('✅ WorkPackageItem created (config only):', item.id);

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error('❌ CreateWorkPackageItem error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create work package item',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
