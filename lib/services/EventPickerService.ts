/**
 * EventPickerService
 * 
 * OpenAI-powered event picker based on user preferences
 * Uses OpenAI to intelligently select events that match preferences + persona
 * Returns events organized by time frame
 * 
 * Flow:
 * 1. Get EventTuner preferences
 * 2. Get candidate EventMeta records
 * 3. Filter by hard constraints (cost, location, travel distance)
 * 4. Call OpenAI with preferences + persona to intelligently pick best events
 * 5. Parse results by time frame
 * 6. Return organized events (even if user wants 1 per quarter, give 3 options)
 */

import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';
import { filterEventsByTuner } from './EventTunerFilterService';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export interface PickedEvent {
  eventMetaId: string;
  eventName: string;
  eventType: string;
  startDate?: Date | null;
  endDate?: Date | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  costMin?: number | null;
  costMax?: number | null;
  timeFrame: string; // "Q1 2025", "Q2 2025", etc.
  recommendationScore: number; // 0-100
  recommendationRationale: string; // Why this event matches preferences
}

export interface EventPickerResult {
  eventsByTimeFrame: {
    [timeFrame: string]: PickedEvent[];
  };
  summary: string; // Overall summary based on preferences
}

/**
 * Generate picked events from EventTuner using OpenAI
 * Returns events organized by time frame
 * Even if user wants 1 per quarter, we give 3 options
 */
export async function pickEventsByPreferences(
  eventTunerId: string
): Promise<EventPickerResult> {
  // Get EventTuner with preferences
  const tuner = await prisma.event_tuners.findUnique({
    where: { id: eventTunerId },
    include: {
      preferredStates: true,
      event_tuner_personas: {
        include: {
          personas: true,
        },
      },
    },
  });

  if (!tuner) {
    throw new Error('EventTuner not found');
  }

  // Get candidate EventMeta records
  const candidateEvents = await prisma.event_metas.findMany({
    take: 200, // Get a good pool
    orderBy: { createdAt: 'desc' },
  });

  // Filter by hard constraints (cost, location, travel distance)
  const filteredEvents = await filterEventsByTuner(eventTunerId, candidateEvents);

  if (filteredEvents.length === 0) {
    return {
      eventsByTimeFrame: {},
      summary: 'No events match your preferences. Try adjusting your constraints.',
    };
  }

  // Build preferences summary
  const preferencesSummary = buildPreferencesSummary(tuner);
  
  // Build events summary for OpenAI with index mapping
  const eventsForOpenAI = filteredEvents.slice(0, 100); // Limit to top 100 for OpenAI
  const eventIndexMap = new Map<number, typeof filteredEvents[0]>();
  
  const eventsSummary = eventsForOpenAI
    .map((event, idx) => {
      const eventIndex = idx + 1; // 1-based index
      eventIndexMap.set(eventIndex, event);
      
      const dateStr = event.dateRange || 
        (event.startDate ? new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'TBD');
      const costStr = event.costMin && event.costMax 
        ? `$${event.costMin}-$${event.costMax}` 
        : event.costMin 
          ? `$${event.costMin}+` 
          : 'Free';
      
      return `Event ${eventIndex}:
- ID: ${event.id}
- Name: ${event.name}
- Type: ${event.eventType}
- Location: ${event.city || ''} ${event.state || ''} ${event.country || ''}
- Date: ${dateStr}
- Cost: ${costStr}`;
    })
    .join('\n\n');

  // Build persona summary if exists
  let personaSummary = '';
  if (tuner.event_tuner_personas.length > 0) {
    const persona = tuner.event_tuner_personas[0].personas;
    personaSummary = `
Persona Context:
- Title: ${persona.title || persona.personName || 'Not specified'}
- Industry: ${persona.industry || 'Not specified'}
- Location: ${persona.location || 'Not specified'}
- Description: ${persona.description || 'Not specified'}
`;
  }

  // Calculate how many events to pick per quarter
  const eventsPerQuarter = tuner.conferencesPerQuarter ? Math.max(3, tuner.conferencesPerQuarter) : 3;
  // Always give at least 3 options even if they want 1

  const prompt = `You are an event intelligence assistant. Based on the user's preferences, intelligently select the best events.

${preferencesSummary}

${personaSummary}

Available Events (pre-filtered by your constraints):
${eventsSummary}

Select the BEST events that match the preferences. Return ${eventsPerQuarter} events per quarter (even if they requested fewer - give them options to choose from).

Return JSON ONLY:
{
  "summary": "Brief summary of event selection based on preferences",
  "events": [
    {
      "eventIndex": 1, // Use the Event number from the list above (1-based)
      "timeFrame": "Q1 2025", // Parse from event date - use format like "Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", or "Upcoming"
      "recommendationScore": 0-100, // How well this matches preferences
      "recommendationRationale": "Why this event matches their preferences"
    },
    ...
  ]
}

IMPORTANT: Use the eventIndex number (1, 2, 3, etc.) from the event list above. Do NOT make up eventMetaId - just use eventIndex.

Selection Criteria:
- Match cost range preferences
- Match location preferences (preferred states if specified)
- Match travel distance preferences
- Match search keywords if provided
- If persona exists, consider persona fit (industry, location, goals)
- Prioritize variety across quarters
- Consider event type diversity

Parse time frames from event dates into quarters. Return exactly ${eventsPerQuarter} events per quarter where possible.`;

  // Call OpenAI
  const openai = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.5,
    messages: [
      {
        role: 'system',
        content: 'You are an event intelligence assistant. Return only valid JSON. No markdown, no code blocks.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  // Parse response
  let pickerData: any;
  try {
    pickerData = JSON.parse(content);
  } catch (parseError) {
    console.error('❌ Failed to parse OpenAI JSON response:', parseError);
    throw new Error('Invalid JSON response from OpenAI');
  }

  // Map OpenAI results back to actual events using eventIndex
  const pickedEventIds: string[] = [];
  for (const eventData of pickerData.events || []) {
    const eventIndex = eventData.eventIndex;
    const actualEvent = eventIndexMap.get(eventIndex);
    if (actualEvent) {
      pickedEventIds.push(actualEvent.id);
    }
  }

  // Fetch full EventMeta details for picked events
  const eventMetaDetails = await prisma.event_metas.findMany({
    where: { id: { in: pickedEventIds } },
  });
  
  // Create a map of event details by ID
  const eventDetailsMap = new Map<string, typeof eventMetaDetails[0]>(eventMetaDetails.map(e => [e.id, e]));

  // Build final picked events with full details
  const pickedEvents: PickedEvent[] = [];
  for (const eventData of pickerData.events || []) {
    const eventIndex = eventData.eventIndex;
    const actualEvent = eventIndexMap.get(eventIndex);
    
    if (actualEvent) {
      const eventDetails = eventDetailsMap.get(actualEvent.id);
      if (eventDetails) {
        pickedEvents.push({
          eventMetaId: actualEvent.id,
          eventName: actualEvent.name,
          eventType: eventDetails.eventType,
          startDate: eventDetails.startDate,
          endDate: eventDetails.endDate,
          city: eventDetails.city,
          state: eventDetails.state,
          country: eventDetails.country,
          costMin: eventDetails.costMin,
          costMax: eventDetails.costMax,
          timeFrame: eventData.timeFrame || 'Upcoming',
          recommendationScore: eventData.recommendationScore || 0,
          recommendationRationale: eventData.recommendationRationale || '',
        });
      }
    }
  }

  // Organize by time frame
  const eventsByTimeFrame: { [timeFrame: string]: PickedEvent[] } = {};
  for (const event of pickedEvents) {
    if (!eventsByTimeFrame[event.timeFrame]) {
      eventsByTimeFrame[event.timeFrame] = [];
    }
    eventsByTimeFrame[event.timeFrame].push(event);
  }

  return {
    eventsByTimeFrame,
    summary: pickerData.summary || 'Events selected based on your preferences',
  };
}

function buildPreferencesSummary(tuner: any): string {
  const parts: string[] = [];
  
  parts.push('User Preferences:');
  
  if (tuner.costRange) {
    parts.push(`- Cost Range: ${formatCostRange(tuner.costRange)}`);
  }
  
  if (tuner.travelDistance) {
    parts.push(`- Travel Distance: ${formatTravelDistance(tuner.travelDistance)}`);
  }
  
  if (tuner.preferredStates.length > 0) {
    const states = tuner.preferredStates.map((ps: any) => ps.state).join(', ');
    parts.push(`- Preferred States: ${states}`);
  }
  
  if (tuner.eventSearchRawText) {
    parts.push(`- Search Keywords: ${tuner.eventSearchRawText}`);
  }
  
  if (tuner.conferencesPerQuarter) {
    parts.push(`- Conferences Per Quarter: ${tuner.conferencesPerQuarter} (but give ${Math.max(3, tuner.conferencesPerQuarter)} options per quarter)`);
  }
  
  return parts.join('\n');
}

function formatCostRange(range: string): string {
  const map: { [key: string]: string } = {
    'FREE': 'Free',
    'LOW_0_500': '$0-$500',
    'MEDIUM_500_2000': '$500-$2,000',
    'HIGH_2000_5000': '$2,000-$5,000',
    'PREMIUM_5000_PLUS': '$5,000+',
    'NO_LIMIT': 'No limit',
  };
  return map[range] || range;
}

function formatTravelDistance(distance: string): string {
  const map: { [key: string]: string } = {
    'LOCAL': 'Local',
    'REGIONAL': 'Regional',
    'DOMESTIC': 'Domestic',
    'INTERNATIONAL': 'International',
    'NO_LIMIT': 'No limit',
  };
  return map[distance] || distance;
}

