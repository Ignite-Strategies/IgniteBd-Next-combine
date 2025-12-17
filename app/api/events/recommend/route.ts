import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { generateEventRecommendations } from '@/lib/services/EventPlannerService';
import type { EventRecommendationRequest } from '@/types/events';

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
    const body: EventRecommendationRequest = await request.json();

    // Validate required fields
    if (!body.persona) {
      return NextResponse.json(
        { error: 'Persona is required' },
        { status: 400 }
      );
    }

    if (!body.filters || !body.filters.priorityTypes || body.filters.priorityTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one priority filter is required' },
        { status: 400 }
      );
    }

    // Generate recommendations
    const events = await generateEventRecommendations({
      persona: body.persona,
      filters: body.filters,
      userRegion: body.userRegion || null,
      count: body.count || 6,
    });

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error: any) {
    console.error('❌ Event recommendation error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to generate event recommendations',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

