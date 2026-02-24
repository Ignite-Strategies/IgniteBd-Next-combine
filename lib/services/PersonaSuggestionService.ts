/**
 * PersonaSuggestionService
 * 
 * Analyzes contact notes to extract relationship information and suggest
 * appropriate outreach personas based on:
 * - Former company
 * - Primary work/services provided
 * - Relationship quality
 * - Opportunity type (referrals, repeat business, etc.)
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

export interface ExtractedInfo {
  formerCompany?: string;
  primaryWork?: string;
  relationshipQuality?: string;
  opportunityType?: string;
}

export interface PersonaSuggestionResult {
  success: boolean;
  suggestedPersonaSlug?: string;
  confidence?: number;
  extractedInfo?: ExtractedInfo;
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

      // Call OpenAI to analyze notes and suggest persona
      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing business relationship notes and suggesting appropriate outreach personas. 
Your task is to:
1. Extract key information from contact notes (former company, primary work, relationship quality, opportunity type)
2. Suggest the most appropriate outreach persona slug from the available personas
3. Provide a confidence score (0-100) and reasoning

Return a JSON object with:
- extractedInfo: { formerCompany?, primaryWork?, relationshipQuality?, opportunityType? }
- suggestedPersonaSlug: string (must match one of the available persona slugs exactly)
- confidence: number (0-100)
- reasoning: string (brief explanation of why this persona fits)`,
          },
          {
            role: 'user',
            content: `Analyze these contact notes and suggest an outreach persona:

Contact Notes:
${notesToAnalyze}

Available Outreach Personas:
${availablePersonas.map((p) => `- ${p.slug}: ${p.name}${p.description ? ` - ${p.description}` : ''}`).join('\n')}

Return JSON with extractedInfo, suggestedPersonaSlug, confidence, and reasoning.`,
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

      const { extractedInfo, suggestedPersonaSlug, confidence, reasoning } = parsedResponse;

      // Validate that suggested persona exists
      if (suggestedPersonaSlug) {
        const personaExists = availablePersonas.some((p) => p.slug === suggestedPersonaSlug);
        if (!personaExists) {
          console.warn(`Suggested persona slug "${suggestedPersonaSlug}" not found in available personas`);
        }
      }

      return {
        success: true,
        suggestedPersonaSlug: suggestedPersonaSlug || null,
        confidence: typeof confidence === 'number' ? Math.max(0, Math.min(100, confidence)) : undefined,
        extractedInfo: extractedInfo || {},
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
