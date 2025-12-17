export interface EventCost {
  min: number | null;
  max: number | null;
  currency: "USD";
}

export interface EventSuggestion {
  id: string;

  eventName: string;
  eventSeriesName: string | null;

  organizerName: string;
  producerType: "Commercial" | "Association" | "Media" | "Institution" | "Corporate";

  city: string;
  stateOrRegion: string | null;

  startDate: string | null;
  endDate: string | null;

  cost: EventCost;

  personaAlignment: number;   // 0–100

  url?: string;
}

