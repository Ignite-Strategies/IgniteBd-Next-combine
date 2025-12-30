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
      event_tuner_states: true,
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

  console.log(`📊 EventPickerService: Found ${candidateEvents.length} candidate events, ${filteredEvents.length} passed filters`);

  // Build preferences summary
  const preferencesSummary = buildPreferencesSummary(tuner);
  
  // Build events summary for OpenAI with index mapping
  // If no filtered events, we'll still call OpenAI but tell it to generate/hydrate from knowledge
  const eventsForOpenAI = filteredEvents.slice(0, 100); // Limit to top 100 for OpenAI
  const eventIndexMap = new Map<number, typeof filteredEvents[0]>();
  
  let eventsSummary: string;
  let hasFilteredEvents = filteredEvents.length > 0;
  
  if (hasFilteredEvents) {
    eventsSummary = eventsForOpenAI
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
  } else {
    // No filtered events - tell OpenAI to generate/hydrate from knowledge
    eventsSummary = 'No events in database match the exact constraints. You must generate/hydrate event recommendations from your knowledge of real events that would fit these preferences.';
    console.log('⚠️ EventPickerService: No filtered events found - asking OpenAI to generate/hydrate events');
  }

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

${hasFilteredEvents ? `Available Events (pre-filtered by your constraints):
${eventsSummary}

Select the BEST events that match the preferences. Return ${eventsPerQuarter} events per quarter (even if they requested fewer - give them options to choose from).

IMPORTANT: Use the eventIndex number (1, 2, 3, etc.) from the event list above. Do NOT make up eventMetaId - just use eventIndex.` : `NO EVENTS IN DATABASE MATCH THE CONSTRAINTS.

You must generate/hydrate event recommendations from your knowledge of REAL, SPECIFIC events that would fit these preferences. These should be actual events you know about - conferences, trade shows, networking events, etc.

Return ${eventsPerQuarter} events per quarter. For each event, you must provide:
- A real event name (e.g., "LegalTech 2025", "ABA Annual Meeting", "State Bar Convention")
- A realistic time frame (Q1 2025, Q2 2025, etc.)
- Location that matches preferences
- Cost that matches preferences
- Event type

IMPORTANT: Since these are not in the database, use eventIndex: 0 for all events (this signals they are generated/hydrated).`}

Return JSON ONLY:
{
  "summary": "Brief summary of event selection based on preferences",
  "events": [
    {
      "eventIndex": ${hasFilteredEvents ? '1' : '0'}, // Use the Event number from the list above (1-based), or 0 if generated
      "eventName": "${hasFilteredEvents ? '(use name from list above)' : '(REAL event name from your knowledge)'}",
      "eventType": "CONFERENCE" | "TRADE_SHOW" | "NETWORKING" | "SEMINAR" | "WORKSHOP" | "SUMMIT",
      "timeFrame": "Q1 2025", // Parse from event date - use format like "Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", or "Upcoming"
      "city": "City name",
      "state": "State code (e.g., CA, NY, TX) or null",
      "country": "Country or null",
      "costMin": 0, // Minimum cost in dollars
      "costMax": 1000, // Maximum cost in dollars
      "startDate": "2025-01-15", // ISO date string or null
      "endDate": "2025-01-17", // ISO date string or null
      "recommendationScore": 0-100, // How well this matches preferences
      "recommendationRationale": "Why this event matches their preferences"
    },
    ...
  ]
}

CRITICAL: You MUST return at least ${eventsPerQuarter} events. If no perfect matches exist, send whatever you think is good - could be anything that reasonably fits. The user needs options, not an empty result.

Selection Criteria:
- Match cost range preferences (or close to it)
- Match location preferences (preferred states if specified, or nearby)
- Match travel distance preferences (or reasonable alternatives)
- Match search keywords if provided (or related events)
- If persona exists, consider persona fit (industry, location, goals)
- Prioritize variety across quarters
- Consider event type diversity

Parse time frames from event dates into quarters. Return exactly ${eventsPerQuarter} events per quarter where possible.`;

  // Call OpenAI
  const openai = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  console.log(`🤖 EventPickerService: Calling OpenAI (${model})...`);
  console.log(`📝 EventPickerService: Prompt length: ${prompt.length} chars`);
  console.log(`📝 EventPickerService: Has filtered events: ${hasFilteredEvents}, Events count: ${filteredEvents.length}`);

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.7, // Increased for more creative generation when needed
    messages: [
      {
        role: 'system',
        content: 'You are an event intelligence assistant. Return only valid JSON. No markdown, no code blocks. You MUST return at least some events - never return an empty events array.',
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
    console.error('❌ EventPickerService: No response from OpenAI');
    throw new Error('No response from OpenAI');
  }

  console.log(`✅ EventPickerService: Received response from OpenAI (${content.length} chars)`);
  console.log(`📄 EventPickerService: Response preview: ${content.substring(0, 500)}...`);

  // Parse response
  let pickerData: any;
  try {
    pickerData = JSON.parse(content);
    console.log(`✅ EventPickerService: Successfully parsed JSON, events count: ${pickerData.events?.length || 0}`);
  } catch (parseError) {
    console.error('❌ EventPickerService: Failed to parse OpenAI JSON response:', parseError);
    console.error('❌ EventPickerService: Raw response:', content);
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('⚠️ EventPickerService: Attempting to extract JSON from markdown...');
      pickerData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  // Validate we got events
  if (!pickerData.events || pickerData.events.length === 0) {
    console.error('❌ EventPickerService: OpenAI returned empty events array');
    throw new Error('OpenAI returned no events. Please try again or adjust your preferences.');
  }

  console.log(`📊 EventPickerService: Processing ${pickerData.events.length} events from OpenAI`);

  // Map OpenAI results back to actual events using eventIndex
  // If eventIndex is 0, it means OpenAI generated/hydrated the event (not in database)
  const pickedEventIds: string[] = [];
  const generatedEvents: any[] = [];
  
  for (const eventData of pickerData.events || []) {
    const eventIndex = eventData.eventIndex;
    
    if (eventIndex === 0 || !hasFilteredEvents) {
      // This is a generated/hydrated event - use OpenAI's data directly
      generatedEvents.push(eventData);
    } else {
      // This is from the database - look it up
      const actualEvent = eventIndexMap.get(eventIndex);
      if (actualEvent) {
        pickedEventIds.push(actualEvent.id);
      } else {
        console.warn(`⚠️ EventPickerService: EventIndex ${eventIndex} not found in map, treating as generated`);
        generatedEvents.push(eventData);
      }
    }
  }

  // Fetch full EventMeta details for picked events (only if we have database events)
  let eventDetailsMap = new Map();
  if (pickedEventIds.length > 0) {
    const eventMetaDetails = await prisma.event_metas.findMany({
      where: { id: { in: pickedEventIds } },
    });
    eventDetailsMap = new Map<string, typeof eventMetaDetails[0]>(eventMetaDetails.map(e => [e.id, e]));
    console.log(`📊 EventPickerService: Found ${eventMetaDetails.length} events in database`);
  }

  // Build final picked events with full details
  const pickedEvents: PickedEvent[] = [];
  for (const eventData of pickerData.events || []) {
    const eventIndex = eventData.eventIndex;
    
    if (eventIndex === 0 || !hasFilteredEvents) {
      // Generated/hydrated event - use OpenAI's data directly
      pickedEvents.push({
        eventMetaId: `generated-${Date.now()}-${Math.random()}`, // Generate a temporary ID
        eventName: eventData.eventName || 'Event',
        eventType: eventData.eventType || 'CONFERENCE',
        startDate: eventData.startDate ? new Date(eventData.startDate) : null,
        endDate: eventData.endDate ? new Date(eventData.endDate) : null,
        city: eventData.city || null,
        state: eventData.state || null,
        country: eventData.country || null,
        costMin: eventData.costMin || null,
        costMax: eventData.costMax || null,
        timeFrame: eventData.timeFrame || 'Upcoming',
        recommendationScore: eventData.recommendationScore || 0,
        recommendationRationale: eventData.recommendationRationale || 'Generated event recommendation',
      });
    } else {
      // Database event - use actual event details
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
  }

  console.log(`✅ EventPickerService: Built ${pickedEvents.length} final events (${generatedEvents.length} generated, ${pickedEventIds.length} from database)`);

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
  
  if (tuner.event_tuner_states.length > 0) {
    const states = tuner.event_tuner_states.map((ps: any) => ps.state).join(', ');
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

