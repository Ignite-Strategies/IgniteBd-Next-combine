/**
 * Normalize Company Data from Apollo Enrichment
 * 
 * Extracts all normalized company fields from Apollo enrichment payload
 * Returns data structure matching Company model fields
 */

import type { ApolloPersonMatchResponse } from '@/lib/apollo';

export interface NormalizedCompanyFields {
  // Basic Info
  companyName?: string;
  domain?: string;
  website?: string;
  industry?: string;
  
  // Size & Scale
  headcount?: number;
  revenue?: number;
  revenueRange?: string;
  
  // Financial
  growthRate?: number;
  
  // Funding
  fundingStage?: string;
  lastFundingDate?: Date;
  lastFundingAmount?: number;
  numberOfFundingRounds?: number;
}

/**
 * Normalize company fields from Apollo enrichment payload
 */
export function normalizeCompanyApollo(apolloData: ApolloPersonMatchResponse): NormalizedCompanyFields {
  const org = (apolloData as any).person?.organization;
  if (!org) {
    return {};
  }

  const normalized: NormalizedCompanyFields = {};

  // Basic Info
  if (org.name) normalized.companyName = org.name;
  if (org.primary_domain) {
    normalized.domain = org.primary_domain;
  } else if (org.website_url) {
    try {
      const url = new URL(org.website_url);
      normalized.domain = url.hostname.replace(/^www\./, '');
      normalized.website = org.website_url;
    } catch {
      // Invalid URL, skip
    }
  }
  if (org.industry) normalized.industry = org.industry;

  // Size & Scale
  const employees = org.employees || org.estimated_num_employees;
  if (employees) normalized.headcount = employees;

  // Financial
  if (org.annual_revenue) normalized.revenue = org.annual_revenue;
  if (org.revenue_range) normalized.revenueRange = org.revenue_range;
  if (org.growth_rate !== undefined && org.growth_rate !== null) {
    normalized.growthRate = org.growth_rate;
  }

  // Funding
  const fundingEvents = org.funding_events || [];
  if (fundingEvents.length > 0) {
    normalized.numberOfFundingRounds = fundingEvents.length;
    
    // Get most recent funding event
    const sortedEvents = fundingEvents
      .filter((event: any) => event.date)
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA; // Most recent first
      });
    
    if (sortedEvents.length > 0) {
      const latest = sortedEvents[0];
      if (latest.date) normalized.lastFundingDate = new Date(latest.date);
      if (latest.amount) normalized.lastFundingAmount = latest.amount;
      
      // Infer funding stage from round name or amount
      if (latest.round) {
        normalized.fundingStage = latest.round.toLowerCase();
      } else if (latest.amount) {
        // Heuristic: infer stage from amount
        if (latest.amount < 1000000) normalized.fundingStage = 'seed';
        else if (latest.amount < 5000000) normalized.fundingStage = 'series-a';
        else if (latest.amount < 20000000) normalized.fundingStage = 'series-b';
        else normalized.fundingStage = 'series-c';
      }
    }
  }

  return normalized;
}

