import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/event-tuners/create
 * Create a new EventTuner (user's event program constraints)
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const {
      companyHQId,
      ownerId,
      name,
      conferencesPerQuarter,
      costRange,
      eventSearchRawText,
      travelDistance,
      preferredStates,
      personaIds,
    } = body;

    if (!companyHQId || !ownerId || !name) {
      return NextResponse.json(
        { success: false, error: 'companyHQId, ownerId, and name are required' },
        { status: 400 }
      );
    }

    // Create EventTuner
    const tuner = await prisma.event_tuners.create({
      data: {
        companyHQId,
        ownerId,
        name,
        conferencesPerQuarter: conferencesPerQuarter || null,
        costRange: costRange || null,
        eventSearchRawText: eventSearchRawText || null,
        travelDistance: travelDistance || null,
        isActive: true,
      },
    });

    // Add preferred states (many-to-many)
    if (preferredStates && Array.isArray(preferredStates) && preferredStates.length > 0) {
      await Promise.all(
        preferredStates.map((state: string) =>
          prisma.event_tuner_states.create({
            data: {
              eventTunerId: tuner.id,
              state,
            },
          })
        )
      );
    }

    // Add personas (many-to-many, optional)
    if (personaIds && Array.isArray(personaIds) && personaIds.length > 0) {
      await Promise.all(
        personaIds.map((personaId: string) =>
          prisma.event_tuner_personas.create({
            data: {
              eventTunerId: tuner.id,
              personaId,
            },
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      tuner,
    });
  } catch (error: any) {
    console.error('❌ Create EventTuner error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create event tuner',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

