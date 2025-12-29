import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { findOrCreateOrganizer } from '@/lib/services/organizerMatcher';
import { parseCSV } from '@/lib/services/csvMappers';
import { generateEventRecommendations } from '@/lib/services/EventRecommendationService';

/**
 * Map producerType string to EventType enum
 */
function mapProducerTypeToEventType(producerType: string): 'ASSOCIATION' | 'COMMERCIAL' | 'MEDIA' | 'INDUSTRY' | 'PRIVATE' | 'CORPORATE' {
  const mapping: Record<string, 'ASSOCIATION' | 'COMMERCIAL' | 'MEDIA' | 'INDUSTRY' | 'PRIVATE' | 'CORPORATE'> = {
    Association: 'ASSOCIATION',
    Commercial: 'COMMERCIAL',
    Media: 'MEDIA',
    Institution: 'INDUSTRY',
    Corporate: 'CORPORATE',
  };
  return mapping[producerType] || 'COMMERCIAL';
}

/**
 * Parse date string to DateTime or return null
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * POST /api/events/meta/ingest
 * Ingest events from GPT generation, CSV, or manual entry
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, data } = body;

    let eventMetas = [];

    if (type === 'persona') {
      // Generate from persona + priorities
      const { personaId, priorities, travelPreference, budgetPreference, userRegion, count } = data;

      if (!personaId) {
        return NextResponse.json({ success: false, error: 'personaId is required' }, { status: 400 });
      }

      // Get persona
      const persona = await prisma.personas.findUnique({
        where: { id: personaId },
      });

      if (!persona) {
        return NextResponse.json({ success: false, error: 'Persona not found' }, { status: 404 });
      }

      // Generate event recommendations (using existing service)
      const events = await generateEventRecommendations({
        persona,
        priorities: priorities || [],
        travelPreference: travelPreference || 'anywhere',
        budgetPreference: budgetPreference || 'standard',
        userRegion: userRegion || null,
        count: count || 6,
      });

      // Convert to EventMeta format and save
      for (const event of events) {
        // Find or create organizer
        const { org } = await findOrCreateOrganizer(event.organizerName);

        // Check if EventMeta already exists
        const existing = await prisma.eventMeta.findFirst({
          where: {
            name: { equals: event.name, mode: 'insensitive' },
            organizerId: org.id,
          },
        });

        if (existing) {
          eventMetas.push(existing);
          continue;
        }

        // Create EventMeta
        const eventMeta = await prisma.eventMeta.create({
          data: {
            name: event.name,
            seriesName: event.eventSeriesName || null,
            eventType: mapProducerTypeToEventType(event.producerType),
            organizerId: org.id,
            city: event.city || null,
            state: event.stateOrRegion || null,
            startDate: parseDate(event.startDate),
            endDate: parseDate(event.endDate),
            dateRange: event.dateRange || null,
            costMin: event.costMin || null,
            costMax: event.costMax || null,
            currency: event.currency || 'USD',
            sourceType: 'AI',
            rawJson: event.rawJson || null,
          },
        });

        eventMetas.push(eventMeta);
      }

      return NextResponse.json({
        success: true,
        count: eventMetas.length,
        eventMetas,
      });
    } else if (type === 'text') {
      // Parse natural language query (e.g., "give me 50 events for Dealmaker persona in 2026")
      // For now, return error - this requires more complex NLP parsing
      return NextResponse.json(
        { success: false, error: 'Text query parsing not yet implemented. Use persona type.' },
        { status: 400 }
      );
    } else if (type === 'csv') {
      // Handle CSV upload
      return NextResponse.json({ success: false, error: 'CSV upload not yet implemented' }, { status: 400 });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid type. Use: persona, text, or csv' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ EventMeta ingest error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to ingest events',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/events/meta
 * Get all event metas
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const eventType = searchParams.get('eventType') as any;

    const where: any = {};
    if (eventType) {
      where.eventType = eventType;
    }

    const eventMetas = await prisma.eventMeta.findMany({
      where,
      include: {
        organizer: true,
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      count: eventMetas.length,
      eventMetas,
    });
  } catch (error) {
    console.error('❌ Get event metas error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch event metas',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

