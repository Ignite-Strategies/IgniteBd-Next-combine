/**
 * EmailTypeDeterminationService
 * 
 * Determines email type (FIRST_TIME vs FOLLOWUP) based on:
 * - Persona
 * - Relationship context
 * - Last email send date
 * 
 * Flow:
 * 1. Check if last email exists
 * 2. If no last email → FIRST_TIME
 * 3. If last email exists → check persona, relationship context, and time since last send
 * 4. Determine if it's a followup (immediate, quarterly check-in, etc.)
 */

import { getLastSendDate } from './followUpCalculator';

export type EmailType = 'FIRST_TIME' | 'FOLLOWUP';

export interface EmailTypeContext {
  emailType: EmailType;
  lastSendDate: Date | null;
  daysSinceLastSend: number | null;
  personaSlug?: string | null;
  relationshipContext?: {
    contextOfRelationship?: string;
    relationshipRecency?: string;
    companyAwareness?: string;
  };
  reasoning: string;
}

export class EmailTypeDeterminationService {
  /**
   * Determine email type for a contact
   */
  static async determineEmailType(
    contactId: string,
    personaSlug?: string | null,
    relationshipContext?: {
      contextOfRelationship?: string;
      relationshipRecency?: string;
      companyAwareness?: string;
    }
  ): Promise<EmailTypeContext> {
    // Get last send date
    const lastSendDate = await getLastSendDate(contactId);
    
    // If no last email, it's first time
    if (!lastSendDate) {
      return {
        emailType: 'FIRST_TIME',
        lastSendDate: null,
        daysSinceLastSend: null,
        personaSlug: personaSlug || null,
        relationshipContext,
        reasoning: 'No previous emails sent to this contact. This is a first-time outreach.',
      };
    }
    
    // Calculate days since last send
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastSend = new Date(lastSendDate);
    lastSend.setHours(0, 0, 0, 0);
    const daysSinceLastSend = Math.floor((today.getTime() - lastSend.getTime()) / (1000 * 60 * 60 * 24));
    
    // Determine followup type based on time and context
    let reasoning = `Last email sent ${daysSinceLastSend} day${daysSinceLastSend !== 1 ? 's' : ''} ago.`;
    
    // Check if it's a quarterly check-in (90+ days)
    if (daysSinceLastSend >= 90) {
      reasoning += ' This is a quarterly check-in followup.';
    } else if (daysSinceLastSend >= 7) {
      reasoning += ' This is a follow-up email.';
    } else if (daysSinceLastSend >= 3) {
      reasoning += ' This is a short-term follow-up.';
    } else {
      reasoning += ' This is a recent follow-up (checking back).';
    }
    
    // Add persona context if available
    if (personaSlug) {
      reasoning += ` Persona: ${personaSlug}.`;
    }
    
    // Add relationship context if available
    if (relationshipContext?.relationshipRecency) {
      reasoning += ` Relationship recency: ${relationshipContext.relationshipRecency}.`;
    }
    
    return {
      emailType: 'FOLLOWUP',
      lastSendDate,
      daysSinceLastSend,
      personaSlug: personaSlug || null,
      relationshipContext,
      reasoning,
    };
  }
}
