# EventPickerService Prompt Audit

## Overview
This document provides a comprehensive audit of the EventPickerService prompt and OpenAI integration, including logging, error handling, and the actual prompt structure.

## Service Location
- **File**: `lib/services/EventPickerService.ts`
- **Function**: `pickEventsByPreferences(eventTunerId: string)`
- **API Route**: `app/api/event-tuners/[tunerId]/pick-events/route.ts`

## Key Changes Made

### 1. Always Call OpenAI (No Early Returns)
**Previous Behavior**: If `filteredEvents.length === 0`, the service would return early with an empty result.

**New Behavior**: Always calls OpenAI, even when no events match filters. OpenAI is instructed to generate/hydrate events from its knowledge.

**Code Location**: Lines 92-99 (removed early return)

### 2. Comprehensive Logging
Added detailed logging throughout the service to track:
- Number of candidate events vs filtered events
- Whether OpenAI is being asked to generate or select
- Full prompt length and preview
- OpenAI response length and preview
- JSON parsing success/failure
- Final event counts (generated vs database)

**Log Points**:
- `📊 EventPickerService: Found X candidate events, Y passed filters`
- `⚠️ EventPickerService: No filtered events found - asking OpenAI to generate/hydrate events`
- `🤖 EventPickerService: Calling OpenAI (model)...`
- `📝 EventPickerService: Prompt length: X chars`
- `✅ EventPickerService: Received response from OpenAI (X chars)`
- `📄 EventPickerService: Response preview: ...`
- `✅ EventPickerService: Successfully parsed JSON, events count: X`
- `📊 EventPickerService: Processing X events from OpenAI`
- `✅ EventPickerService: Built X final events (Y generated, Z from database)`

### 3. Updated Prompt Structure

#### System Prompt
```
You are an event intelligence assistant. Return only valid JSON. No markdown, no code blocks. You MUST return at least some events - never return an empty events array.
```

**Key Points**:
- Explicitly requires JSON output
- Explicitly forbids empty events array
- No markdown or code blocks

#### User Prompt Structure

**When Filtered Events Exist**:
```
You are an event intelligence assistant. Based on the user's preferences, intelligently select the best events.

[Preferences Summary]
[Persona Summary]

Available Events (pre-filtered by your constraints):
[Event List with Indexes]

Select the BEST events that match the preferences. Return X events per quarter (even if they requested fewer - give them options to choose from).

IMPORTANT: Use the eventIndex number (1, 2, 3, etc.) from the event list above. Do NOT make up eventMetaId - just use eventIndex.
```

**When NO Filtered Events Exist**:
```
You are an event intelligence assistant. Based on the user's preferences, intelligently select the best events.

[Preferences Summary]
[Persona Summary]

NO EVENTS IN DATABASE MATCH THE CONSTRAINTS.

You must generate/hydrate event recommendations from your knowledge of REAL, SPECIFIC events that would fit these preferences. These should be actual events you know about - conferences, trade shows, networking events, etc.

Return X events per quarter. For each event, you must provide:
- A real event name (e.g., "LegalTech 2025", "ABA Annual Meeting", "State Bar Convention")
- A realistic time frame (Q1 2025, Q2 2025, etc.)
- Location that matches preferences
- Cost that matches preferences
- Event type

IMPORTANT: Since these are not in the database, use eventIndex: 0 for all events (this signals they are generated/hydrated).
```

#### Critical Instruction (Both Cases)
```
CRITICAL: You MUST return at least X events. If no perfect matches exist, send whatever you think is good - could be anything that reasonably fits. The user needs options, not an empty result.
```

**Key Points**:
- Explicitly tells OpenAI to return something even if not perfect
- "send whatever you think is good - could be anything"
- Emphasizes user needs options, not empty results

### 4. Response Format

#### JSON Structure
```json
{
  "summary": "Brief summary of event selection based on preferences",
  "events": [
    {
      "eventIndex": 1, // or 0 if generated
      "eventName": "Event Name", // Required if generated
      "eventType": "CONFERENCE" | "TRADE_SHOW" | "NETWORKING" | "SEMINAR" | "WORKSHOP" | "SUMMIT",
      "timeFrame": "Q1 2025",
      "city": "City name",
      "state": "State code (e.g., CA, NY, TX) or null",
      "country": "Country or null",
      "costMin": 0,
      "costMax": 1000,
      "startDate": "2025-01-15", // ISO date string or null
      "endDate": "2025-01-17", // ISO date string or null
      "recommendationScore": 0-100,
      "recommendationRationale": "Why this event matches their preferences"
    }
  ]
}
```

### 5. Event Processing Logic

#### Database Events (eventIndex > 0)
1. Look up event in `eventIndexMap`
2. Fetch full details from `event_metas` table
3. Use database values for all fields
4. Apply OpenAI's `timeFrame`, `recommendationScore`, `recommendationRationale`

#### Generated Events (eventIndex = 0)
1. Use OpenAI's provided data directly
2. Generate temporary ID: `generated-${Date.now()}-${Math.random()}`
3. Use OpenAI's `eventName`, `eventType`, location, cost, dates
4. All fields come from OpenAI response

### 6. Error Handling

#### JSON Parsing
- Primary: `JSON.parse(content)`
- Fallback: Extract JSON from markdown using regex `/\{[\s\S]*\}/`
- Logs full error and raw response on failure

#### Validation
- Checks for empty `events` array
- Throws error if no events returned
- Logs event counts at each step

#### API Route Error Handling
- Logs full error, stack trace, and message
- Returns detailed error in development mode
- Returns sanitized error in production

## OpenAI API Call Details

### Model
- Default: `gpt-4o-mini`
- Override: `process.env.OPENAI_MODEL`

### Temperature
- **Previous**: 0.5
- **New**: 0.7 (increased for more creative generation when needed)

### Response Format
```typescript
{
  model: 'gpt-4o-mini',
  temperature: 0.7,
  messages: [
    {
      role: 'system',
      content: 'You are an event intelligence assistant. Return only valid JSON. No markdown, no code blocks. You MUST return at least some events - never return an empty events array.',
    },
    {
      role: 'user',
      content: prompt, // Full prompt with preferences, persona, events
    },
  ],
  response_format: { type: 'json_object' },
}
```

## Flow Diagram

```
1. Get EventTuner preferences
   ↓
2. Get candidate events from database (200 max)
   ↓
3. Filter by hard constraints (cost, location, travel, search text)
   ↓
4. Build prompt with:
   - Preferences summary
   - Persona summary (if exists)
   - Event list (if filtered events exist) OR generation instruction
   ↓
5. Call OpenAI with explicit instruction:
   - "CRITICAL: You MUST return at least X events"
   - "If no perfect matches exist, send whatever you think is good - could be anything"
   ↓
6. Parse JSON response
   ↓
7. Process events:
   - If eventIndex > 0: Look up in database
   - If eventIndex = 0: Use OpenAI's generated data
   ↓
8. Organize by time frame
   ↓
9. Return eventsByTimeFrame + summary
```

## Testing Checklist

- [ ] Test with events that match filters
- [ ] Test with events that don't match filters (should generate)
- [ ] Test with no events in database (should generate)
- [ ] Test with persona attached
- [ ] Test with no persona
- [ ] Test with strict constraints (should still return something)
- [ ] Verify logging appears in console
- [ ] Verify error handling works
- [ ] Verify at least one event is always returned

## Known Issues / Future Improvements

1. **Generated Events Storage**: Currently generated events are not saved to database. Consider saving them for future reference.

2. **Travel Distance Calculation**: Currently not implemented. Should calculate actual distance from user location.

3. **Event Validation**: Generated events are not validated against real event databases. Consider adding validation step.

4. **Retry Logic**: No automatic retry if OpenAI fails. Consider adding retry with exponential backoff.

5. **Caching**: No caching of OpenAI responses. Consider caching for same tuner/preferences.

## Related Files

- `lib/services/EventTunerFilterService.ts` - Handles hard constraint filtering
- `app/api/event-tuners/[tunerId]/pick-events/route.ts` - API route
- `app/(authenticated)/events/search-pick/[tunerId]/page.tsx` - Frontend display
- `docs/OPENAI_PATTERN.md` - General OpenAI pattern documentation

