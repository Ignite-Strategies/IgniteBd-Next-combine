import { z } from "zod";

export const PersonaMatchSignalsSchema = z.object({
  industryMatch: z.number().min(0).max(100),
  roleMatch: z.number().min(0).max(100),
  seniorityMatch: z.number().min(0).max(100),
  themeMatch: z.number().min(0).max(100),
  speakerMatch: z.number().min(0).max(100),
  sponsorMatch: z.number().min(0).max(100),
  audienceMatch: z.number().min(0).max(100),
  geoMatch: z.number().min(0).max(100),
});

export const BDEventOppSchema = z.object({
  id: z.string().optional(),

  companyHQId: z.string(),
  ownerId: z.string(),

  name: z.string(),
  eventSeriesName: z.string().nullable().optional(),

  organizerName: z.string(),
  producerType: z.enum([
    "Commercial",
    "Association",
    "Media",
    "Institution",
    "Corporate"
  ]),

  location: z.string().nullable().optional(),
  city: z.string().optional(),
  stateOrRegion: z.string().nullable().optional(),

  dateRange: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),

  costMin: z.number().nullable().optional(),
  costMax: z.number().nullable().optional(),
  currency: z.literal("USD").optional(),

  personaAlignment: z.number().min(0).max(100),
  matchSignals: PersonaMatchSignalsSchema,

  relevanceReason: z.string().optional(),
  url: z.string().url().nullable().optional(),

  rawJson: z.any().optional(),
});

