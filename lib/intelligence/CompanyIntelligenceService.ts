/**
 * CompanyIntelligenceService
 * 
 * Computes company intelligence scores from stored data
 * These scores are derived from enrichment and stored in Company model
 */

import type { companies } from '@prisma/client';

/**
 * Compute company readiness score from companies model
 * 
 * Returns companyHealthScore from stored field
 * Falls back to 0 if score not computed yet
 */
export function computeCompanyReadiness(company: companies): number {
  return company.companyHealthScore ?? 0;
}

