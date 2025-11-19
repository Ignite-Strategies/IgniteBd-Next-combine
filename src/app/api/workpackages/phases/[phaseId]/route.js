import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { updatePhaseDatesFromStatus, overwritePhaseDates, recalculateAllPhaseDates } from '@/lib/services/PhaseDueDateService';

/**
 * PATCH /api/workpackages/phases/:phaseId
 * Update phase status and dates
 * 
 * Body:
 * - status: "not_started" | "in_progress" | "completed"
 * - estimatedStartDate: Date (optional, overwrite)
 * - estimatedEndDate: Date (optional, overwrite)
 * - actualStartDate: Date (optional, overwrite)
 * - actualEndDate: Date (optional, overwrite)
 */
export async function PATCH(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { phaseId } = await params;
    if (!phaseId) {
      return NextResponse.json(
        { success: false, error: 'Phase ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { status, estimatedStartDate, estimatedEndDate, actualStartDate, actualEndDate } = body;

    // If status is provided, update dates based on status
    if (status) {
      const updatedPhase = await updatePhaseDatesFromStatus(phaseId, status);
      
      // If status changed, may need to recalculate subsequent phases
      const phase = await prisma.workPackagePhase.findUnique({
        where: { id: phaseId },
        select: { workPackageId: true },
      });

      if (phase) {
        // Recalculate all phases to update progressive dates
        await recalculateAllPhaseDates(phase.workPackageId, false);
      }

      return NextResponse.json({
        success: true,
        phase: updatedPhase,
      });
    }

    // If date fields are provided, overwrite them
    if (estimatedStartDate !== undefined || estimatedEndDate !== undefined || 
        actualStartDate !== undefined || actualEndDate !== undefined) {
      const updatedPhase = await overwritePhaseDates(phaseId, {
        estimatedStartDate,
        estimatedEndDate,
        actualStartDate,
        actualEndDate,
      });

      // Recalculate subsequent phases if actual dates changed
      if (actualStartDate !== undefined || actualEndDate !== undefined) {
        const phase = await prisma.workPackagePhase.findUnique({
          where: { id: phaseId },
          select: { workPackageId: true },
        });

        if (phase) {
          await recalculateAllPhaseDates(phase.workPackageId, false);
        }
      }

      return NextResponse.json({
        success: true,
        phase: updatedPhase,
      });
    }

    return NextResponse.json(
      { success: false, error: 'No valid fields provided for update' },
      { status: 400 },
    );
  } catch (error) {
    console.error('❌ UpdatePhase error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update phase',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

