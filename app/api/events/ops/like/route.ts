import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/events/ops/like
 * Save an event as "I like it" - creates bd_event_ops from EventMeta
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
      eventMetaId,           // Legacy: from database events
      eventTitle,            // New: from EventPickerModel
      description,           // New: from EventPickerModel
      location,              // New: from EventPickerModel
      timeFrame,             // New: from EventPickerModel
      sponsor,               // New: from EventPickerModel
      costEstimate,          // New: from EventPickerModel
      companyHQId, 
      ownerId, 
      eventTunerId, 
      whyGo 
    } = body;

    if (!companyHQId || !ownerId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and ownerId are required' },
        { status: 400 }
      );
    }

    // Handle EventPickerModel (new AI-generated events) vs EventMeta (legacy database events)
    let title: string;
    let eventType: string = 'CONFERENCE'; // Default
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let city: string | null = null;
    let state: string | null = null;
    let country: string | null = null;
    let costBand: string | null = null;

    if (eventMetaId) {
      // Legacy: Get EventMeta from database
      const eventMeta = await prisma.event_metas.findUnique({
        where: { id: eventMetaId },
      });

      if (!eventMeta) {
        return NextResponse.json(
          { success: false, error: 'EventMeta not found' },
          { status: 404 }
        );
      }

      title = eventMeta.name;
      eventType = eventMeta.eventType;
      startDate = eventMeta.startDate;
      endDate = eventMeta.endDate;
      city = eventMeta.city;
      state = eventMeta.state;
      country = eventMeta.country;
      costBand = eventMeta.costMin && eventMeta.costMax
        ? determineCostBand(eventMeta.costMin, eventMeta.costMax)
        : null;
    } else if (eventTitle) {
      // New: Use EventPickerModel data
      title = eventTitle;
      // Parse location if provided (e.g., "San Francisco, CA")
      if (location) {
        const parts = location.split(',').map(s => s.trim());
        if (parts.length >= 2) {
          city = parts[0];
          const stateOrCountry = parts[1];
          // Check if it's a US state (2 letters) or country
          if (stateOrCountry.length === 2) {
            state = stateOrCountry;
          } else {
            country = stateOrCountry;
          }
        } else {
          city = location;
        }
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Either eventMetaId or eventTitle is required' },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await prisma.bd_event_ops.findFirst({
      where: {
        companyHQId,
        ownerId,
        title,
        ...(startDate && { startDate }),
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        eventOp: existing,
        message: 'Event already saved',
      });
    }

    // Create bd_event_ops
    const eventOp = await prisma.bd_event_ops.create({
      data: {
        companyHQId,
        ownerId,
        eventTunerId: eventTunerId || null,
        title,
        description: description || null,
        whyGo: whyGo || null,
        eventType,
        startDate,
        endDate,
        city,
        state,
        country,
        location: location || null,           // New field
        timeFrame: timeFrame || null,         // New field
        sponsor: sponsor || null,             // New field
        costEstimate: costEstimate || null,  // New field
        costBand,
        source: eventTunerId ? 'USER_PREF' : 'MANUAL',
        status: 'CONSIDERING',
      },
    });

    return NextResponse.json({
      success: true,
      eventOp,
    });
  } catch (error: any) {
    console.error('❌ Like event error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save event',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

function determineCostBand(costMin: number, costMax: number): string {
  const avg = (costMin + costMax) / 2;
  if (avg === 0) return 'FREE';
  if (avg < 500) return 'LOW';
  if (avg < 2000) return 'MEDIUM';
  if (avg < 5000) return 'HIGH';
  return 'PREMIUM';
}

