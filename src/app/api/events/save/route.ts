import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import type { EventSuggestion } from '@/types/events';

export async function POST(request: Request) {
  try {
    // Verify authentication
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { eventSuggestion, userId, personaId } = body;

    // Validate required fields
    if (!eventSuggestion) {
      return NextResponse.json(
        { error: 'Event suggestion is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate event structure
    const event: EventSuggestion = eventSuggestion;
    if (!event.name || !event.totalScore || !event.relevanceReason) {
      return NextResponse.json(
        { error: 'Invalid event suggestion structure' },
        { status: 400 }
      );
    }

    // Save event to database
    const savedEvent = await prisma.savedEvent.create({
      data: {
        userId,
        personaId: personaId || null,
        name: event.name,
        organization: event.organization || null,
        producerType: event.producerType || null,
        dateRange: event.dateRange || null,
        location: event.location || null,
        relevanceReason: event.relevanceReason,
        totalScore: event.totalScore,
        rawJson: event as any, // Store full event object as JSON
      },
    });

    return NextResponse.json({
      success: true,
      savedEvent: {
        id: savedEvent.id,
        name: savedEvent.name,
        createdAt: savedEvent.createdAt,
      },
    });
  } catch (error: any) {
    console.error('❌ Save event error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to save event',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

