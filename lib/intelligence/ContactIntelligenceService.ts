/**
 * ContactIntelligenceService
 * 
 * Computes contact intelligence scores from stored data
 * These scores are derived from enrichment and stored in Contact model
 */

import type { Contact } from '@prisma/client';

export interface ContactIntelligence {
  seniority: number; // 0-100
  buyingPower: number; // 0-100
  urgency: number; // 0-100
}

/**
 * Compute contact intelligence from Contact model
 * 
 * Returns intelligence scores from stored fields (seniorityScore, buyingPowerScore, urgencyScore)
 * Falls back to 0 if scores not computed yet
 */
export function computeContactIntelligence(contact: Contact): ContactIntelligence {
  return {
    seniority: contact.seniorityScore ?? 0,
    buyingPower: contact.buyingPowerScore ?? 0,
    urgency: contact.urgencyScore ?? 0,
  };
}

