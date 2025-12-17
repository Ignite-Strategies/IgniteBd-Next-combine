export type EventProducerType =
  | "Association"
  | "Commercial"
  | "Media"
  | "Institution"
  | "Corporate";

export interface EventSuggestion {
  name: string;
  producerType: EventProducerType;
  organization: string;
  location: string | null;
  dateRange: string | null;

  wellKnownScore: number;       // 1–10
  attendanceScore: number;      // 1–10
  bdValueScore: number;         // 1–10
  travelFitScore: number;       // 1–10
  costScore: number;            // 1–10

  totalScore: number;           // sum of above
  relevanceReason: string;
  url?: string;
}

export interface EventRecommendationRequest {
  persona: any;  // Raw persona object
  filters: {
    priorityTypes: string[];  // ["well-known", "well-attended", ...]
    regionPreference?: string;
    travelPreference?: string;
    budgetPreference?: string;
  };
  userRegion?: string | null;
  count?: number; // default 6
}

