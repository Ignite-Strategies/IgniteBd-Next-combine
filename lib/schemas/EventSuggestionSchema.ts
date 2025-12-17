import { z } from "zod";

export const EventSuggestionSchema = z.object({
  id: z.string(),

  eventName: z.string(),
  eventSeriesName: z.string().nullable(),

  organizerName: z.string(),
  producerType: z.enum(["Commercial", "Association", "Media", "Institution", "Corporate"]),

  city: z.string(),
  stateOrRegion: z.string().nullable(),

  startDate: z.string().nullable(),
  endDate: z.string().nullable(),

  cost: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.literal("USD"),
  }),

  personaAlignment: z.number().min(0).max(100),

  url: z.string().url().optional(),
});

