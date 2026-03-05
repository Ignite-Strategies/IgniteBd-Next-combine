/**
 * PersonaSuggestionService
 * 
 * Analyzes contact notes to extract TWO things:
 * 
 * 1. RELATIONSHIP CONTEXT (Source of Truth) - Factual data extracted from notes:
 *    - Former company, primary work, relationship quality, opportunity type
 *    - Maps to relationship_contexts dimensions (contextOfRelationship, relationshipRecency, companyAwareness)
 *    - This is the factual foundation
 * 
 * 2. PERSONA (Fills Gaps) - Classification that helps template matching:
 *    - Uses relationship context + AI inference to detect patterns
 *    - Examples: "CompetitorSwitchingProspect", "FormerClientReferralOpportunity"
 *    - Drives snippet selection in template assembly
 * 
 * Together, relationship context + persona drive the outreach note.
 */

import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export interface RelationshipContextInfo {
  // Three core signals — stored as plain strings (not DB enums)
  // Conventional values documented in relationship_contexts schema comments.
  contextOfRelationship?: string; // e.g. "PRIOR_COLLEAGUE", "REFERRAL", "PRIOR_CLIENT"
  relationshipRecency?: string;   // e.g. "RECENT", "STALE", "LONG_DORMANT"
  companyAwareness?: string;      // e.g. "KNOWS_COMPANY", "KNOWS_COMPANY_COMPETITOR"
  formerCompany?: string;         // e.g. "WeCommerce" — only if explicitly in notes
}

export interface PersonaSuggestionResult {
  success: boolean;
  // Relationship Context (source of truth)
  relationshipContext?: RelationshipContextInfo;
  // Persona (fills gaps, drives template matching)
  suggestedPersonaSlug?: string;
  confidence?: number;
  reasoning?: string;
  error?: string;
}

export class PersonaSuggestionService {
  /**
   * Analyze contact notes and suggest an outreach persona
   */
  static async suggestPersona(
    contactId: string,
    note?: string
  ): Promise<PersonaSuggestionResult> {
    try {
      // Fetch contact and existing notes
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          notes: true,
          firstName: true,
          lastName: true,
          title: true,
          companies: {
            select: {
              companyName: true,
            },
          },
        },
      });

      if (!contact) {
        return {
          success: false,
          error: 'Contact not found',
        };
      }

      // Use provided note or existing notes
      const notesToAnalyze = note || contact.notes || '';

      if (!notesToAnalyze.trim()) {
        return {
          success: false,
          error: 'No notes available to analyze',
        };
      }

      // Fetch available outreach personas to suggest from
      const availablePersonas = await prisma.outreach_personas.findMany({
        select: {
          slug: true,
          name: true,
          description: true,
        },
        orderBy: { name: 'asc' },
      });

      // Call OpenAI to analyze notes and extract BOTH relationship context AND persona
      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing business relationship notes for a BD outreach tool. Extract exactly THREE relationship signals and suggest a persona.

THREE SIGNALS ONLY — do not add extra fields:

1. contextOfRelationship — how does the sender know this person?
   Values: DONT_KNOW | PRIOR_CONVERSATION | PRIOR_COLLEAGUE | PRIOR_SCHOOLMATE | CURRENT_CLIENT | CONNECTED_LINKEDIN_ONLY | REFERRAL | REFERRAL_FROM_WARM_CONTACT | USED_TO_WORK_AT_TARGET_COMPANY

2. relationshipRecency — how recent/active is the relationship?
   Values: NEW | RECENT | STALE | LONG_DORMANT

3. companyAwareness — does the contact know the sender's company/service?
   Values: DONT_KNOW | KNOWS_COMPANY | KNOWS_COMPANY_COMPETITOR | KNOWS_BUT_DISENGAGED

Also extract formerCompany (string) ONLY if explicitly mentioned in the notes — the company this person previously worked at or that connects you. Leave null if unclear.

DO NOT extract: opportunityType, primaryWork, relationshipQuality, or any other freeform fields. Those create noise.

Return JSON:
{
  "relationshipContext": {
    "contextOfRelationship": "<enum value>",
    "relationshipRecency": "<enum value>",
    "companyAwareness": "<enum value>",
    "formerCompany": "<string or null>"
  },
  "suggestedPersonaSlug": "<must exactly match one available slug>",
  "confidence": <0-100>,
  "reasoning": "<one sentence explaining the persona fit>"
}`,
          },
          {
            role: 'user',
            content: `Analyze these contact notes:

${notesToAnalyze}

Available Outreach Personas:
${availablePersonas.map((p) => `- ${p.slug}: ${p.name}${p.description ? ` - ${p.description}` : ''}`).join('\n')}

Return JSON with the three relationship signals, formerCompany, suggestedPersonaSlug, confidence, and reasoning.`,
          },
        ],
        temperature: 0.3,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        return {
          success: false,
          error: 'No response from AI',
        };
      }

      // Parse JSON response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(responseContent);
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[1]);
        } else {
          throw parseError;
        }
      }

      const { relationshipContext, suggestedPersonaSlug, confidence, reasoning } = parsedResponse;

      // Validate that suggested persona exists
      if (suggestedPersonaSlug) {
        const personaExists = availablePersonas.some((p) => p.slug === suggestedPersonaSlug);
        if (!personaExists) {
          console.warn(`Suggested persona slug "${suggestedPersonaSlug}" not found in available personas`);
        }
      }

      return {
        success: true,
        relationshipContext: relationshipContext || {},
        suggestedPersonaSlug: suggestedPersonaSlug || null,
        confidence: typeof confidence === 'number' ? Math.max(0, Math.min(100, confidence)) : undefined,
        reasoning: reasoning || 'No reasoning provided',
      };
    } catch (error: any) {
      console.error('Error suggesting persona:', error);
      return {
        success: false,
        error: error.message || 'Failed to analyze notes and suggest persona',
      };
    }
  }
}
