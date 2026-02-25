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
  // Factual extracted data (source of truth)
  formerCompany?: string;
  primaryWork?: string;
  relationshipQuality?: string;
  opportunityType?: string;
  
  // Relationship context dimensions (maps to relationship_contexts table)
  contextOfRelationship?: 'DONT_KNOW' | 'PRIOR_CONVERSATION' | 'PRIOR_COLLEAGUE' | 'PRIOR_SCHOOLMATE' | 'CURRENT_CLIENT' | 'CONNECTED_LINKEDIN_ONLY' | 'REFERRAL' | 'REFERRAL_FROM_WARM_CONTACT' | 'USED_TO_WORK_AT_TARGET_COMPANY';
  relationshipRecency?: 'NEW' | 'RECENT' | 'STALE' | 'LONG_DORMANT';
  companyAwareness?: 'DONT_KNOW' | 'KNOWS_COMPANY' | 'KNOWS_COMPANY_COMPETITOR' | 'KNOWS_BUT_DISENGAGED';
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
            content: `You are an expert at analyzing business relationship notes. Your task is to extract TWO things:

1. RELATIONSHIP CONTEXT (Source of Truth) - Factual data from notes:
   - Extract factual details: formerCompany, primaryWork, relationshipQuality, opportunityType
   - Classify relationship dimensions:
     * contextOfRelationship: DONT_KNOW, PRIOR_CONVERSATION, PRIOR_COLLEAGUE, PRIOR_SCHOOLMATE, CURRENT_CLIENT, CONNECTED_LINKEDIN_ONLY, REFERRAL, REFERRAL_FROM_WARM_CONTACT, USED_TO_WORK_AT_TARGET_COMPANY
     * relationshipRecency: NEW, RECENT, STALE, LONG_DORMANT
     * companyAwareness: DONT_KNOW, KNOWS_COMPANY, KNOWS_COMPANY_COMPETITOR, KNOWS_BUT_DISENGAGED

2. PERSONA (Fills Gaps) - Classification for template matching:
   - Suggest the most appropriate outreach persona slug from available personas
   - Use relationship context + AI inference to detect patterns (e.g., competitor switching, referral opportunities)
   - Provide confidence score (0-100) and reasoning

Return a JSON object with:
- relationshipContext: { formerCompany?, primaryWork?, relationshipQuality?, opportunityType?, contextOfRelationship?, relationshipRecency?, companyAwareness? }
- suggestedPersonaSlug: string (must match one of the available persona slugs exactly)
- confidence: number (0-100)
- reasoning: string (brief explanation of why this persona fits, considering relationship context)`,
          },
          {
            role: 'user',
            content: `Analyze these contact notes and extract relationship context + suggest persona:

Contact Notes:
${notesToAnalyze}

Available Outreach Personas:
${availablePersonas.map((p) => `- ${p.slug}: ${p.name}${p.description ? ` - ${p.description}` : ''}`).join('\n')}

Return JSON with relationshipContext, suggestedPersonaSlug, confidence, and reasoning.`,
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
