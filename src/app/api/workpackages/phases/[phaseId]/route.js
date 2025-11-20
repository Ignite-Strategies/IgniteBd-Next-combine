import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { updatePhaseDatesFromStatus, updatePhaseDates } from '@/lib/services/PhaseDueDateService';

/**
 * PATCH /api/workpackages/phases/:phaseId
 * Update phase status, dates, or duration
 * 
 * Body:
 * - status: "not_started" | "in_progress" | "completed"
 * - estimatedStartDate: Date (optional, user edit)
 * - estimatedEndDate: Date (optional, user edit)
 * - phaseTotalDuration: number (optional, user edit - days)
 * - actualStartDate: Date (optional, manual override)
 * - actualEndDate: Date (optional, manual override)
 * 
 * Editing Paths:
 * 1. Edit status → sets actualStartDate/actualEndDate (if empty)
 * 2. Edit estimatedStartDate → shifts subsequent phases by delta
 * 3. Edit estimatedEndDate → recalculates duration, shifts subsequent phases
 * 4. Edit phaseTotalDuration → recalculates end date, shifts subsequent phases
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
    const { 
      status, 
      estimatedStartDate, 
      estimatedEndDate, 
      phaseTotalDuration,
      actualStartDate, 
      actualEndDate 
    } = body;

    // Path 1: Status change (sets actual dates, no phase shifting)
    if (status) {
      const updatedPhase = await updatePhaseDatesFromStatus(phaseId, status);
      
      return NextResponse.json({
        success: true,
        phase: updatedPhase,
      });
    }

    // Path 2-4: Date or duration editing (shifts subsequent phases)
    if (
      estimatedStartDate !== undefined || 
      estimatedEndDate !== undefined || 
      phaseTotalDuration !== undefined ||
      actualStartDate !== undefined || 
      actualEndDate !== undefined
    ) {
      const updateData = {};

      // Handle estimated dates and duration (these trigger phase shifting)
      if (estimatedStartDate !== undefined) {
        updateData.estimatedStartDate = estimatedStartDate ? new Date(estimatedStartDate) : null;
      }
      if (estimatedEndDate !== undefined) {
        updateData.estimatedEndDate = estimatedEndDate ? new Date(estimatedEndDate) : null;
      }
      if (phaseTotalDuration !== undefined) {
        // Ensure it's a number, not a string
        updateData.phaseTotalDuration = phaseTotalDuration === null || phaseTotalDuration === '' 
          ? null 
          : parseInt(phaseTotalDuration, 10);
        if (isNaN(updateData.phaseTotalDuration)) {
          return NextResponse.json(
            { success: false, error: 'phaseTotalDuration must be a valid number' },
            { status: 400 },
          );
        }
      }

      // Handle actual dates (these do NOT trigger phase shifting)
      if (actualStartDate !== undefined) {
        updateData.actualStartDate = actualStartDate ? new Date(actualStartDate) : null;
      }
      if (actualEndDate !== undefined) {
        updateData.actualEndDate = actualEndDate ? new Date(actualEndDate) : null;
      }

      // Use updatePhaseDates which handles delta calculation and shifting
      const updatedPhase = await updatePhaseDates(phaseId, updateData);

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
