import { BDEventOpp, PersonaMatchSignals } from "@/lib/types/BD_EventOpp";

/**
 * Transform AI event (legacy or new format) to BDEventOpp
 * Handles both legacy format (with scoring) and new format (with matchSignals)
 */
export function transformEventAIToOpp(
  aiEvent: any,
  companyHQId: string,
  ownerId: string
): BDEventOpp {
  // Handle legacy format: convert 5 sub-scores to matchSignals and personaAlignment
  let personaAlignment: number;
  let matchSignals: PersonaMatchSignals;

  if (aiEvent.matchSignals) {
    // New format: has matchSignals
    matchSignals = aiEvent.matchSignals;
    personaAlignment = aiEvent.personaAlignment || 
      Math.round(
        (matchSignals.industryMatch +
         matchSignals.roleMatch +
         matchSignals.seniorityMatch +
         matchSignals.themeMatch +
         matchSignals.speakerMatch +
         matchSignals.sponsorMatch +
         matchSignals.audienceMatch +
         matchSignals.geoMatch) / 8
      );
  } else {
    // Legacy format: convert 5 sub-scores (1-10) to matchSignals (0-100) and personaAlignment
    const wellKnown = (aiEvent.wellKnownScore || 5) * 10; // 1-10 -> 0-100
    const attendance = (aiEvent.attendanceScore || 5) * 10;
    const bdValue = (aiEvent.bdValueScore || 5) * 10;
    const travelFit = (aiEvent.travelFitScore || 5) * 10;
    const cost = (aiEvent.costScore || 5) * 10;

    // Map legacy scores to matchSignals (approximate mapping)
    matchSignals = {
      industryMatch: bdValue, // BD value correlates with industry fit
      roleMatch: bdValue, // BD value correlates with role fit
      seniorityMatch: attendance, // Attendance correlates with seniority
      themeMatch: bdValue, // BD value correlates with theme fit
      speakerMatch: wellKnown, // Well-known events have better speakers
      sponsorMatch: wellKnown, // Well-known events have better sponsors
      audienceMatch: attendance, // Attendance correlates with audience quality
      geoMatch: travelFit, // Direct mapping
    };

    // Calculate personaAlignment as average of matchSignals
    personaAlignment = Math.round(
      (matchSignals.industryMatch +
       matchSignals.roleMatch +
       matchSignals.seniorityMatch +
       matchSignals.themeMatch +
       matchSignals.speakerMatch +
       matchSignals.sponsorMatch +
       matchSignals.audienceMatch +
       matchSignals.geoMatch) / 8
    );
  }

  return {
    companyHQId,
    ownerId,

    name: aiEvent.name || aiEvent.eventName,
    eventSeriesName: aiEvent.eventSeriesName || null,

    organizerName: aiEvent.organizerName || aiEvent.organization,
    producerType: aiEvent.producerType,

    location: aiEvent.location || null,
    city: aiEvent.city || null,
    stateOrRegion: aiEvent.stateOrRegion || null,

    dateRange: aiEvent.dateRange || null,
    startDate: aiEvent.startDate || null,
    endDate: aiEvent.endDate || null,

    costMin: aiEvent.cost?.min ?? aiEvent.costMin ?? null,
    costMax: aiEvent.cost?.max ?? aiEvent.costMax ?? null,
    currency: aiEvent.cost?.currency ?? aiEvent.currency ?? "USD",

    personaAlignment,
    matchSignals,

    relevanceReason: aiEvent.relevanceReason,
    url: aiEvent.url ?? null,

    rawJson: aiEvent,
  };
}

