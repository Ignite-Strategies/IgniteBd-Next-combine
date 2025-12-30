import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/event-tuners/[tunerId]
 * Get a single event tuner by ID with full details
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tunerId: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { tunerId } = await params;

    if (!tunerId) {
      return NextResponse.json(
        { success: false, error: 'tunerId is required' },
        { status: 400 }
      );
    }

    const tuner = await prisma.event_tuners.findUnique({
      where: { id: tunerId },
      include: {
        event_tuner_states: true,
        event_tuner_personas: {
          include: {
            personas: {
              select: {
                id: true,
                personName: true,
                title: true,
                industry: true,
                location: true,
              },
            },
          },
        },
      },
    });

    if (!tuner) {
      return NextResponse.json(
        { success: false, error: 'Event tuner not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tuner,
    });
  } catch (error: any) {
    console.error('❌ Get event tuner error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get event tuner',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/event-tuners/[tunerId]
 * Update an event tuner
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tunerId: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { tunerId } = await params;
    const body = await request.json();
    const {
      name,
      conferencesPerQuarter,
      costRange,
      eventSearchRawText,
      travelDistance,
      preferredStates,
      personaIds,
    } = body;

    if (!tunerId) {
      return NextResponse.json(
        { success: false, error: 'tunerId is required' },
        { status: 400 }
      );
    }

    // Check if tuner exists
    const existingTuner = await prisma.event_tuners.findUnique({
      where: { id: tunerId },
    });

    if (!existingTuner) {
      return NextResponse.json(
        { success: false, error: 'Event tuner not found' },
        { status: 404 }
      );
    }

    // Update EventTuner
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (conferencesPerQuarter !== undefined) updateData.conferencesPerQuarter = conferencesPerQuarter || null;
    if (costRange !== undefined) updateData.costRange = costRange || null;
    if (eventSearchRawText !== undefined) updateData.eventSearchRawText = eventSearchRawText?.trim() || null;
    if (travelDistance !== undefined) updateData.travelDistance = travelDistance || null;

    const tuner = await prisma.event_tuners.update({
      where: { id: tunerId },
      data: updateData,
    });

    // Update preferred states if provided
    if (preferredStates !== undefined) {
      // Delete existing states
      await prisma.event_tuner_states.deleteMany({
        where: { eventTunerId: tunerId },
      });

      // Add new states
      if (Array.isArray(preferredStates) && preferredStates.length > 0) {
        await Promise.all(
          preferredStates.map((state: string) =>
            prisma.event_tuner_states.create({
              data: {
                eventTunerId: tunerId,
                state,
              },
            })
          )
        );
      }
    }

    // Update personas if provided
    if (personaIds !== undefined) {
      // Delete existing personas
      await prisma.event_tuner_personas.deleteMany({
        where: { eventTunerId: tunerId },
      });

      // Add new personas
      if (Array.isArray(personaIds) && personaIds.length > 0) {
        await Promise.all(
          personaIds.map((personaId: string) =>
            prisma.event_tuner_personas.create({
              data: {
                eventTunerId: tunerId,
                personaId,
              },
            })
          )
        );
      }
    }

    // Fetch updated tuner with relations
    const updatedTuner = await prisma.event_tuners.findUnique({
      where: { id: tunerId },
      include: {
        event_tuner_states: true,
        event_tuner_personas: {
          include: {
            personas: {
              select: {
                id: true,
                personName: true,
                title: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      tuner: updatedTuner,
    });
  } catch (error: any) {
    console.error('❌ Update event tuner error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update event tuner',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/event-tuners/[tunerId]
 * Delete an event tuner (soft delete by setting isActive to false)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tunerId: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { tunerId } = await params;

    if (!tunerId) {
      return NextResponse.json(
        { success: false, error: 'tunerId is required' },
        { status: 400 }
      );
    }

    // Check if tuner exists
    const existingTuner = await prisma.event_tuners.findUnique({
      where: { id: tunerId },
    });

    if (!existingTuner) {
      return NextResponse.json(
        { success: false, error: 'Event tuner not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    await prisma.event_tuners.update({
      where: { id: tunerId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Event tuner deleted successfully',
    });
  } catch (error: any) {
    console.error('❌ Delete event tuner error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete event tuner',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

