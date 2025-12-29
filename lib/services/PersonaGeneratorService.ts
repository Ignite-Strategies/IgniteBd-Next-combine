/**
 * PersonaGeneratorService
 * 
 * Simple persona generation service - helps clients think through who they're targeting.
 * This is a THINKING TOOL, not a complex system.
 * 
 * Returns simple JSON with ~10 fields:
 * - Who is this person? (personName, title, role, seniority)
 * - What do they want? (coreGoal, painPoints, needForOurProduct, potentialPitch)
 * - What company are they at? (industry, companySize, company)
 * 
 * Usage:
 *   const result = await PersonaGeneratorService.generate({
 *     contactId: "contact_123", // OR
 *     redisKey: "preview:123:abc", // OR
 *     description: "Enterprise CMO at SaaS company",
 *     companyHQId: "company_hq_123",
 *     productId: "product_123", // Required - used as context
 *     productDescription: "Our BD platform", // Fallback if no productId
 *   });
 */

import { prisma } from '@/lib/prisma';
import { getEnrichedContact, getEnrichedContactByKey } from '@/lib/redis';
import { OpenAI } from 'openai';

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

export interface PersonaGeneratorOptions {
  contactId?: string;
  redisKey?: string;
  description?: string;
  companyHQId: string;
  productId?: string;
  productDescription?: string;
  notes?: string;
}

export interface PersonaJSON {
  // WHO IS THIS PERSON
  personName: string;
  title: string;
  role: string | null;
  seniority: string | null;
  
  // WHAT DO THEY WANT
  coreGoal: string;              // Their north star (regardless of our product)
  painPoints: string[];          // What problems do they have?
  needForOurProduct: string;     // Need for OUR PRODUCT assessment (key field!)
  potentialPitch: string | null; // How we would pitch (inferred)
  
  // WHAT COMPANY ARE THEY AT
  industry: string | null;
  companySize: string | null;
  company: string | null;        // Company type/archetype
}

export interface PersonaGeneratorResult {
  success: boolean;
  persona?: PersonaJSON;
  error?: string;
  details?: string;
}

export class PersonaGeneratorService {
  /**
   * Generate persona JSON (doesn't save to DB)
   */
  static async generate(options: PersonaGeneratorOptions): Promise<PersonaGeneratorResult> {
    try {
      const { contactId, redisKey, description, companyHQId, productId, productDescription, notes } = options;

      // Validate product context
      if (!productId && !productDescription) {
        return {
          success: false,
          error: 'Product context required. Provide productId or productDescription.',
        };
      }

      // Step 1: Fetch product (if productId provided)
      let product: any = null;
      if (productId) {
        product = await prisma.products.findUnique({
          where: { id: productId },
          select: {
            id: true,
            name: true,
            description: true,
            valueProp: true,
          },
        });

        if (!product) {
          return {
            success: false,
            error: 'Product not found',
          };
        }
      }

      // Step 2: Fetch CompanyHQ
      const companyHQ = await prisma.company_hqs.findUnique({
        where: { id: companyHQId },
        select: {
          id: true,
          companyName: true,
          companyIndustry: true,
          whatYouDo: true,
          teamSize: true,
        },
      });

      if (!companyHQ) {
        return {
          success: false,
          error: 'CompanyHQ not found',
        };
      }

      // Step 3: Fetch contact/enrichment data (if provided)
      let contactData: any = null;
      let apolloData: any = null;

      if (contactId) {
        contactData = await prisma.contact.findUnique({
          where: { id: contactId },
          include: {
            companies: true,
          },
        });

        if (contactData?.enrichmentRedisKey) {
          apolloData = await this.fetchApolloData(contactData.enrichmentRedisKey);
        }
      } else if (redisKey) {
        apolloData = await this.fetchApolloData(redisKey);
      }

      // Step 4: Build prompt
      const { systemPrompt, userPrompt } = this.buildPersonaPrompt({
        product,
        productDescription,
        companyHQ,
        contactData,
        apolloData,
        description,
        notes,
      });

      // Step 5: Call OpenAI
      console.log('🤖 Calling OpenAI for persona generation...');
      const openai = getOpenAIClient();
      const model = process.env.OPENAI_MODEL || 'gpt-4o';

      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        return {
          success: false,
          error: 'No GPT output received',
        };
      }

      // Step 6: Parse and normalize
      const persona = this.parseAndNormalizePersona(content);

      return {
        success: true,
        persona,
      };
    } catch (error: any) {
      console.error('❌ PersonaGeneratorService error:', error);
      return {
        success: false,
        error: 'Failed to generate persona',
        details: error.message,
      };
    }
  }

  /**
   * Build persona prompt
   */
  private static buildPersonaPrompt(context: {
    product: any;
    productDescription?: string;
    companyHQ: any;
    contactData?: any;
    apolloData?: any;
    description?: string;
    notes?: string;
  }): { systemPrompt: string; userPrompt: string } {
    const { product, productDescription, companyHQ, contactData, apolloData, description, notes } = context;

    const systemPrompt = `You are an expert in executive psychology and business persona modeling.

You help clients think through who they're targeting. This is a THINKING TOOL, not a complex system.

Generate a simple persona that answers:
1. Who is this person? (name, title, role, seniority)
2. What do they want? (core goal, pain points, need for product, potential pitch)
3. What company are they at? (industry, size, type)

Return EXACTLY this JSON structure:
{
  "personName": "",           // Name/archetype (e.g., "Enterprise CMO")
  "title": "",                // Required - Role/Title (e.g., "Chief Marketing Officer")
  "role": "",                 // Additional role context (more than just title) - can be null
  "seniority": "",            // Optional - Seniority level (e.g., "C-Level", "Director") - can be null
  "coreGoal": "",             // Required - Their north star (regardless of our product) - what they want in general
  "painPoints": [],           // Array - What problems do they have?
  "needForOurProduct": "",    // Required - Need for OUR PRODUCT assessment (inferred - this is key!)
  "potentialPitch": "",       // Optional - How we would pitch (inferred from pain + needs) - can be null
  "industry": "",             // Optional - Industry type - can be null
  "companySize": "",          // Optional - Company size (e.g., "51-200", "200-1000") - can be null
  "company": ""               // Optional - Company type/archetype (e.g., "mid-market SaaS") - can be null
}`;

    const productContext = product
      ? `Our Product:
Name: ${product.name}
Description: ${product.description || 'Not specified'}
Value Prop: ${product.valueProp || 'Not specified'}`
      : productDescription
      ? `Our Product Description: ${productDescription}`
      : 'No product context provided';

    const companyContext = `Our Company:
Name: ${companyHQ.companyName}
Industry: ${companyHQ.companyIndustry || 'Not specified'}
What We Do: ${companyHQ.whatYouDo || 'Not specified'}
Team Size: ${companyHQ.teamSize || 'Not specified'}`;

    let contactContext = '';
    if (apolloData) {
      contactContext = `Enriched Contact Data:\n${JSON.stringify(apolloData, null, 2)}`;
    } else if (contactData) {
      contactContext = `Contact Data:\n${JSON.stringify({
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        title: contactData.title,
        companyName: contactData.companyName,
        companyIndustry: contactData.companyIndustry,
      }, null, 2)}`;
    } else if (description) {
      contactContext = `Description: ${description}`;
    }

    const userPrompt = `Generate a persona for this targeting scenario.

${productContext}

${companyContext}

${contactContext ? `${contactContext}\n` : ''}${notes ? `Additional Notes: ${notes}\n` : ''}

Remember:
- coreGoal = What they want in general (their north star, regardless of our product)
- needForOurProduct = What they need from OUR PRODUCT specifically (inferred - this is the key field!)
- potentialPitch = How we'd pitch to them (inferred from pain points + needs)
- Keep it simple - this is a thinking tool to help plan targeting

Return the complete persona JSON structure.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse and normalize persona response
   */
  private static parseAndNormalizePersona(content: string): PersonaJSON {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Normalize arrays
    const normalizeArray = (value: any): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch {
          return value.split('\n').filter(Boolean);
        }
      }
      return [];
    };

    const personaData = parsed.persona || parsed;

    return {
      personName: personaData.personName || '',
      title: personaData.title || '',
      role: personaData.role || null,
      seniority: personaData.seniority || null,
      coreGoal: personaData.coreGoal || '',
      painPoints: normalizeArray(personaData.painPoints),
      needForOurProduct: personaData.needForOurProduct || '',
      potentialPitch: personaData.potentialPitch || null,
      industry: personaData.industry || null,
      companySize: personaData.companySize || null,
      company: personaData.company || null,
    };
  }

  /**
   * Fetch Apollo data from Redis
   */
  private static async fetchApolloData(redisKey: string): Promise<any | null> {
    // Try preview intelligence first
    if (redisKey.startsWith('preview:')) {
      try {
        const { getPreviewIntelligence } = await import('@/lib/redis');
        const previewData = await getPreviewIntelligence(redisKey);
        if (previewData?.rawEnrichmentPayload) {
          return previewData.rawEnrichmentPayload;
        }
      } catch (e) {
        // Continue to try other methods
      }
    }

    // Try direct Redis key
    try {
      const data = await getEnrichedContactByKey(redisKey);
      if (data?.rawEnrichmentPayload) {
        return data.rawEnrichmentPayload;
      }
      if (data?.enrichedData?.rawApolloResponse) {
        return data.enrichedData.rawApolloResponse;
      }
      return data;
    } catch (e) {
      // Try as LinkedIn URL
      try {
        const data = await getEnrichedContact(redisKey);
        if (data?.enrichedData?.rawApolloResponse) {
          return data.enrichedData.rawApolloResponse;
        }
        if (data?.enrichedData?.enrichedProfile) {
          return data.enrichedData.enrichedProfile;
        }
        return data;
      } catch (e) {
        return null;
      }
    }
  }
}

