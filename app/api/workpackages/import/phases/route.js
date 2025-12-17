import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { upsertPhase, updatePhaseTotalHours } from '@/lib/services/workpackageHydrationService';

/**
 * POST /api/workpackages/import/phases
 * Step 2: Import phases for existing WorkPackage
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
    const { workPackageId, phases } = body;

    if (!workPackageId || !phases || !Array.isArray(phases)) {
      return NextResponse.json(
        { success: false, error: 'workPackageId and phases array are required' },
        { status: 400 },
      );
    }

    // Verify work package exists
    const workPackage = await prisma.workPackage.findUnique({
      where: { id: workPackageId },
    });

    if (!workPackage) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage not found' },
        { status: 404 },
      );
    }

    const createdPhases = [];
    const updatedPhases = [];

    // Upsert each phase
    for (const phase of phases) {
      const { name, position, description } = phase;

      if (!name || !position) {
        continue; // Skip invalid phases
      }

      const existing = await prisma.workPackagePhase.findFirst({
        where: {
          workPackageId,
          name,
          position,
        },
      });

      const phaseId = await upsertPhase({
        workPackageId,
        name,
        position,
        description,
      });

      if (existing) {
        updatedPhases.push(phaseId);
      } else {
        createdPhases.push(phaseId);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        phasesCreated: createdPhases.length,
        phasesUpdated: updatedPhases.length,
      },
    });
  } catch (error) {
    console.error('❌ Import phases error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to import phases',
      },
      { status: 500 },
    );
  }
}

