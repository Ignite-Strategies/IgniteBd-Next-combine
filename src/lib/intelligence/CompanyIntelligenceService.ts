/**
 * CompanyIntelligenceService
 * 
 * Computes company intelligence scores from stored data
 * These scores are derived from enrichment and stored in Company model
 */

import type { Company } from '@prisma/client';

/**
 * Compute company readiness score from Company model
 * 
 * Returns companyHealthScore from stored field
 * Falls back to 0 if score not computed yet
 */
export function computeCompanyReadiness(company: Company): number {
  return company.companyHealthScore ?? 0;
}

