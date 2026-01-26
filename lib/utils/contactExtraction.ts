/**
 * Simple extraction utilities for contact metadata
 * MVP1: Basic company and position info, no complex intelligence
 */

import type { NormalizedContactData } from '@/lib/apollo';

/**
 * Extract industry from Apollo data
 */
export function extractIndustry(apolloData: any): string | null {
  const industry = apolloData?.person?.organization?.industry;
  if (!industry) return null;
  return industry;
}

/**
 * Infer company size from headcount
 */
export function inferCompanySize(apolloData: any): 'small' | 'medium' | 'large' | null {
  const headcount = apolloData?.person?.organization?.employees || 
                    apolloData?.person?.organization?.estimated_num_employees;
  
  if (!headcount || typeof headcount !== 'number') return null;
  
  if (headcount < 50) return 'small';
  if (headcount < 500) return 'medium';
  return 'large';
}

/**
 * Extract position type from title
 */
export function extractPositionType(title: string | null | undefined): string | null {
  if (!title) return null;
  
  const lower = title.toLowerCase();
  
  // VP level
  if (lower.includes('vp') || lower.includes('vice president') || lower.includes('v.p.')) {
    return 'VP';
  }
  
  // Director level
  if (lower.includes('director')) {
    return 'Director';
  }
  
  // Manager level
  if (lower.includes('manager') || lower.includes('mgr')) {
    return 'Manager';
  }
  
  // Senior level
  if (lower.includes('senior') || lower.includes('sr ') || lower.includes('sr.')) {
    return 'Senior';
  }
  
  // Lead/Principal
  if (lower.includes('lead') || lower.includes('principal')) {
    return 'Lead';
  }
  
  // C-level
  if (lower.includes('ceo') || lower.includes('cto') || lower.includes('cfo') || 
      lower.includes('chief')) {
    return 'C-Level';
  }
  
  // Default
  return 'Individual Contributor';
}

/**
 * Infer "what they're looking for" from career signals
 */
export function inferWhatTheyreLookingFor(contact: {
  recentJobChange?: boolean | null;
  currentTenureYears?: number | null;
  numberOfJobChanges?: number | null;
  averageTenureMonths?: number | null;
  recentPromotion?: boolean | null;
  careerProgression?: string | null;
}): string | null {
  // Recent job change (< 6 months)
  if (contact.recentJobChange && (contact.currentTenureYears || 0) < 0.5) {
    return 'stability'; // Just moved, likely settled
  }
  
  // Long tenure + promotion
  if ((contact.currentTenureYears || 0) > 3 && contact.recentPromotion) {
    return 'growth'; // Growing within company
  }
  
  // Many job changes
  if ((contact.numberOfJobChanges || 0) > 5) {
    return 'opportunity'; // Always looking for next thing
  }
  
  // Short average tenure
  if ((contact.averageTenureMonths || 0) > 0 && (contact.averageTenureMonths || 0) < 18) {
    return 'opportunity'; // Moves frequently
  }
  
  // Long average tenure
  if ((contact.averageTenureMonths || 0) > 36) {
    return 'stability'; // Stays put
  }
  
  // Upward career progression
  if (contact.careerProgression === 'upward') {
    return 'growth'; // Climbing ladder
  }
  
  return null; // Can't infer
}

/**
 * Infer career momentum from signals
 */
export function inferCareerMomentum(contact: {
  recentPromotion?: boolean | null;
  recentJobChange?: boolean | null;
  careerProgression?: string | null;
  currentTenureYears?: number | null;
}): 'high' | 'medium' | 'low' | null {
  let score = 0;
  
  if (contact.recentPromotion) score += 2;
  if (contact.recentJobChange) score += 1;
  if (contact.careerProgression === 'upward') score += 2;
  if (contact.careerProgression === 'lateral') score += 1;
  if ((contact.currentTenureYears || 0) < 2) score += 1; // Recent move
  
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  if (score > 0) return 'low';
  return null;
}

