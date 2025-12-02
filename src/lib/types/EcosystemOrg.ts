export type OrganizationArchetype =
  | "ASSOCIATION"
  | "TRADE_GROUP"
  | "GUILD"
  | "NONPROFIT"
  | "GOVERNMENT"
  | "OTHER";

export interface EcosystemOrg {
  id: string;

  name: string;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  archetype: OrganizationArchetype;

  whatTheyDo?: string | null;
  annualRevenue?: number | null;
  duesInfo?: string | null;
  memberCount?: number | null;

  memberDescription?: string | null;
  memberSeniority?: string | null;
  memberIndustries: string[];
  memberReasonForAffiliation?: string | null;
  memberAffiliationStrength?: string | null;

  orgRelevanceToCompanyHQ?: string | null;
  bdCompanyHQAffiliationScore?: number | null;

  targetPersonaAlignment?: number | null;

  createdAt: string;
}

