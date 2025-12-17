export type ProducerType =
  | "Commercial"
  | "Association"
  | "Media"
  | "Institution"
  | "Corporate";

export interface PersonaMatchSignals {
  industryMatch: number;       // 0–100
  roleMatch: number;           // 0–100
  seniorityMatch: number;      // 0–100
  themeMatch: number;          // 0–100
  speakerMatch: number;        // 0–100
  sponsorMatch: number;        // 0–100
  audienceMatch: number;       // 0–100
  geoMatch: number;            // 0–100
}

export interface BDEventOpp {
  id?: string;                 // Assigned on save

  // Linking Identity
  companyHQId: string;
  ownerId: string;

  // Core Event Data
  name: string;
  eventSeriesName?: string | null;

  organizerName: string;
  producerType: ProducerType;

  // Location
  location?: string | null;        // legacy
  city?: string;
  stateOrRegion?: string | null;

  // Date
  dateRange?: string | null;       // legacy
  startDate?: string | null;
  endDate?: string | null;

  // Cost (optional in MVP)
  costMin?: number | null;
  costMax?: number | null;
  currency?: "USD";

  // Persona Alignment
  personaAlignment: number;        // 0–100
  matchSignals: PersonaMatchSignals;

  // Extra metadata
  relevanceReason?: string;
  url?: string | null;

  rawJson?: any;
}

