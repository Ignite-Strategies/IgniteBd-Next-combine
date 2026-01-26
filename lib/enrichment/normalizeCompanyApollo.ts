/**
 * Normalize Company Data from Apollo Enrichment
 * 
 * Extracts all normalized company fields from Apollo enrichment payload
 * Returns data structure matching Company model fields
 */

import type { ApolloPersonMatchResponse } from '@/lib/apollo';

/**
 * Parse funding amount string to number
 * Handles formats like "930M", "$500K", "2B", "1.5M", "930000000", etc.
 * Returns null if unable to parse
 */
function parseFundingAmount(amount: any): number | null {
  if (typeof amount === 'number') {
    return amount;
  }
  
  if (typeof amount !== 'string') {
    return null;
  }
  
  // Remove whitespace, dollar signs, commas, and convert to uppercase
  const cleaned = amount.trim().toUpperCase().replace(/[\$,]/g, '');
  
  // Extract number and suffix (handles formats like "930M", "$500K", "2.5B", etc.)
  const match = cleaned.match(/^([\d.]+)([KMBD]?)$/);
  if (!match) {
    // If no match, try to parse as plain number (might have commas or other formatting)
    const numericValue = parseFloat(cleaned);
    if (!isNaN(numericValue)) {
      return numericValue;
    }
    return null;
  }
  
  const value = parseFloat(match[1]);
  if (isNaN(value)) {
    return null;
  }
  
  const suffix = match[2];
  let multiplier = 1;
  
  switch (suffix) {
    case 'K':
      multiplier = 1000;
      break;
    case 'M':
      multiplier = 1000000;
      break;
    case 'B':
      multiplier = 1000000000;
      break;
    case 'D': // Sometimes used for "Dollars" but treat as no suffix
      multiplier = 1;
      break;
    default:
      multiplier = 1;
  }
  
  return value * multiplier;
}

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
      
      // Parse funding amount - Apollo may return it as string like "930M" or as number
      if (latest.amount !== undefined && latest.amount !== null) {
        const parsedAmount = parseFundingAmount(latest.amount);
        if (parsedAmount !== null) {
          normalized.lastFundingAmount = parsedAmount;
          if (typeof latest.amount === 'string') {
            console.log(`✅ Parsed funding amount: "${latest.amount}" → ${parsedAmount}`);
          }
        } else {
          console.warn('⚠️ Could not parse funding amount:', {
            rawValue: latest.amount,
            type: typeof latest.amount,
            fundingEvent: latest,
          });
        }
      }
      
      // Infer funding stage from round name or amount
      if (latest.round) {
        normalized.fundingStage = latest.round.toLowerCase();
      } else if (normalized.lastFundingAmount) {
        // Heuristic: infer stage from amount (use parsed numeric value)
        const amount = normalized.lastFundingAmount;
        if (amount < 1000000) normalized.fundingStage = 'seed';
        else if (amount < 5000000) normalized.fundingStage = 'series-a';
        else if (amount < 20000000) normalized.fundingStage = 'series-b';
        else normalized.fundingStage = 'series-c';
      }
    }
  }

  return normalized;
}

