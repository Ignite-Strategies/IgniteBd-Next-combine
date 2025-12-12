import { z } from "zod";

export const EcosystemOrgSchema = z.object({
  name: z.string().min(1),
  website: z.string().url().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),

  archetype: z.enum([
    "ASSOCIATION",
    "TRADE_GROUP",
    "GUILD",
    "NONPROFIT",
    "GOVERNMENT",
    "OTHER",
  ]),

  whatTheyDo: z.string().optional().nullable(),
  annualRevenue: z.number().optional().nullable(),
  duesInfo: z.string().optional().nullable(),
  memberCount: z.number().optional().nullable(),

  memberDescription: z.string().optional().nullable(),
  memberSeniority: z.string().optional().nullable(),
  memberIndustries: z.array(z.string()).default([]),
  memberReasonForAffiliation: z.string().optional().nullable(),
  memberAffiliationStrength: z.string().optional().nullable(),

  orgRelevanceToCompanyHQ: z.string().optional().nullable(),
  bdCompanyHQAffiliationScore: z.number().optional().nullable(),

  targetPersonaAlignment: z.number().optional().nullable(),
});

