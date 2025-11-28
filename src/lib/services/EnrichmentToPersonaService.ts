/**
 * EnrichmentToPersonaService
 * 
 * Unified service that generates Persona, ProductFit, and BdIntel in a single OpenAI call.
 * 
 * This replaces the previous 3-step pipeline:
 * - Old: generate persona → product-fit → bd-intel (3 separate API calls)
 * - New: single unified generation (1 API call)
 * 
 * Usage:
 *   const result = await EnrichmentToPersonaService.run({
 *     redisKey: "preview:123:abc", // or "apollo:enriched:https://linkedin.com/..."
 *     companyHQId: "company_hq_123",
 *     mode: "save" | "hydrate"
 *   });
 */

import { prisma } from '@/lib/prisma';
import { getPreviewIntelligence, getEnrichedContactByKey, getEnrichedContact } from '@/lib/redis';
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

export interface EnrichmentToPersonaOptions {
  redisKey: string; // Preview ID or Redis key with Apollo data
  companyHQId: string;
  mode: 'hydrate' | 'save'; // 'hydrate' = return data only, 'save' = persist to DB
  notes?: string; // Optional freeform human notes
}

export interface EnrichmentToPersonaResult {
  success: boolean;
  persona?: any;
  productFit?: any;
  bdIntel?: any;
  error?: string;
  details?: string;
}

export class EnrichmentToPersonaService {
  /**
   * Main entry point - runs the complete pipeline
   */
  static async run(options: EnrichmentToPersonaOptions): Promise<EnrichmentToPersonaResult> {
    try {
      const { redisKey, companyHQId, mode, notes } = options;

      // Step 1: Fetch Apollo data from Redis
      console.log('🔍 Fetching Apollo data from Redis:', redisKey);
      const apolloData = await this.fetchApolloData(redisKey);
      if (!apolloData) {
        return {
          success: false,
          error: 'Apollo data not found in Redis',
        };
      }

      // Step 2: Fetch CompanyHQ
      console.log('🔍 Fetching CompanyHQ:', companyHQId);
      const companyHQ = await prisma.companyHQ.findUnique({
        where: { id: companyHQId },
        select: {
          id: true,
          companyName: true,
          companyIndustry: true,
          companyAnnualRev: true,
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

      // Step 3: Fetch product list
      console.log('🔍 Fetching products for tenant:', companyHQId);
      const products = await prisma.product.findMany({
        where: { companyHQId },
        select: {
          id: true,
          name: true,
          description: true,
          valueProp: true,
          price: true,
          priceCurrency: true,
          targetMarketSize: true,
          features: true,
          competitiveAdvantages: true,
        },
      });

      if (products.length === 0) {
        return {
          success: false,
          error: 'No products found for this tenant',
        };
      }

      // Step 4: Build unified prompt
      console.log('🤖 Building unified prompt...');
      const { systemPrompt, userPrompt } = this.buildUnifiedPrompt(
        apolloData,
        companyHQ,
        products,
        notes
      );

      // Step 5: Call OpenAI
      console.log('🤖 Calling OpenAI for unified generation...');
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

      // Step 6: Parse and normalize response
      console.log('📦 Parsing GPT response...');
      const parsed = this.parseAndNormalizeResponse(content);

      // Step 7: Save to database if mode is "save"
      if (mode === 'save') {
        console.log('💾 Saving to database...');
        const saved = await this.saveToDatabase(parsed, companyHQId);
        return {
          success: true,
          persona: saved.persona,
          productFit: saved.productFit,
          bdIntel: saved.bdIntel,
        };
      } else {
        // Mode: hydrate - return data only
        return {
          success: true,
          persona: parsed.persona,
          productFit: parsed.productFit,
          bdIntel: parsed.bdIntel,
        };
      }
    } catch (error: any) {
      console.error('❌ EnrichmentToPersonaService error:', error);
      return {
        success: false,
        error: 'Failed to generate persona pipeline',
        details: error.message,
      };
    }
  }

  /**
   * Fetch Apollo data from Redis
   * Handles both previewId format and direct Redis keys
   */
  private static async fetchApolloData(redisKey: string): Promise<any | null> {
    // Try preview intelligence first (from generate-intel endpoint)
    if (redisKey.startsWith('preview:')) {
      const previewData = await getPreviewIntelligence(redisKey);
      if (previewData?.rawEnrichmentPayload) {
        return previewData.rawEnrichmentPayload;
      }
      // If preview has normalized data, extract raw Apollo from redisKey
      if (previewData?.redisKey) {
        const rawData = await getEnrichedContactByKey(previewData.redisKey);
        return rawData?.rawEnrichmentPayload || rawData;
      }
    }

    // Try direct Redis key
    if (redisKey.startsWith('apollo:')) {
      const data = await getEnrichedContactByKey(redisKey);
      if (data?.rawEnrichmentPayload) {
        return data.rawEnrichmentPayload;
      }
      if (data?.enrichedData?.rawApolloResponse) {
        return data.enrichedData.rawApolloResponse;
      }
      return data;
    }

    // Try as LinkedIn URL
    const data = await getEnrichedContact(redisKey);
    if (data?.enrichedData?.rawApolloResponse) {
      return data.enrichedData.rawApolloResponse;
    }
    if (data?.enrichedData?.enrichedProfile) {
      return data.enrichedData.enrichedProfile;
    }

    return data;
  }

  /**
   * Build unified prompt that generates all three models
   */
  private static buildUnifiedPrompt(
    apollo: any,
    companyHQ: any,
    products: any[],
    notes?: string
  ): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are an enterprise-grade business intelligence engine.

You take:
1. A deeply enriched Apollo person profile (raw JSON)
2. A CompanyHQ record (company context)
3. Optional freeform human notes

Your task is to infer 3 separate but connected models:

A. Persona
B. ProductFit
C. BdIntel

Each output MUST match the exact schema definitions (below).
Infer ALL fields, even when not explicitly stated.

Your job is:
- Interpret job title as self-identity
- Interpret company context as environmental constraints
- Infer domain (credit, ops, finance, strategy, etc.)
- Infer behavior, psychology, decision drivers, risks, and triggers
- Use CompanyHQ industry + size + revenue to contextualize pains
- Use Apollo title + headline to infer operational role
- Use cross-signals to assign accurate BD intel scores

When uncertain, infer the MOST LIKELY value based on industry norms.
Never leave fields empty unless explicitly allowed.

Return EXACTLY this JSON structure:
{
  "persona": {
    "personName": "",
    "title": "",
    "headline": "",
    "seniority": "",
    "industry": "",
    "subIndustries": [],
    "company": "",
    "companySize": "",
    "annualRevenue": "",
    "location": "",
    "description": "",
    "whatTheyWant": "",
    "painPoints": [],
    "risks": [],
    "decisionDrivers": [],
    "buyerTriggers": []
  },
  "productFit": {
    "targetProductId": "",
    "valuePropToThem": "",
    "alignmentReasoning": ""
  },
  "bdIntel": {
    "fitScore": 0,
    "painAlignmentScore": 0,
    "workflowFitScore": 0,
    "urgencyScore": 0,
    "adoptionBarrierScore": 0,
    "risks": [],
    "opportunities": [],
    "recommendedTalkTrack": "",
    "recommendedSequence": "",
    "recommendedLeadSource": "",
    "finalSummary": ""
  }
}`;

    const userPrompt = `Generate all three models (Persona, ProductFit, BdIntel) from this data:

APOLLO PROFILE:
${JSON.stringify(apollo, null, 2)}

COMPANY HQ CONTEXT:
${JSON.stringify(companyHQ, null, 2)}

AVAILABLE PRODUCTS:
${JSON.stringify(products, null, 2)}

${notes ? `HUMAN NOTES:\n${notes}\n` : ''}

Return the complete JSON structure with all three models.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse and normalize GPT response
   */
  private static parseAndNormalizeResponse(content: string): {
    persona: any;
    productFit: any;
    bdIntel: any;
  } {
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

    // Normalize persona
    const persona = {
      personName: parsed.persona?.personName || '',
      title: parsed.persona?.title || '',
      headline: parsed.persona?.headline || null,
      seniority: parsed.persona?.seniority || null,
      industry: parsed.persona?.industry || null,
      subIndustries: normalizeArray(parsed.persona?.subIndustries),
      company: parsed.persona?.company || null,
      companySize: parsed.persona?.companySize || null,
      annualRevenue: parsed.persona?.annualRevenue || null,
      location: parsed.persona?.location || null,
      description: parsed.persona?.description || null,
      whatTheyWant: parsed.persona?.whatTheyWant || null,
      painPoints: normalizeArray(parsed.persona?.painPoints),
      risks: normalizeArray(parsed.persona?.risks),
      decisionDrivers: normalizeArray(parsed.persona?.decisionDrivers),
      buyerTriggers: normalizeArray(parsed.persona?.buyerTriggers),
    };

    // Normalize productFit
    const productFit = {
      targetProductId: parsed.productFit?.targetProductId || parsed.productFit?.productId || '',
      valuePropToThem: parsed.productFit?.valuePropToThem || '',
      alignmentReasoning: parsed.productFit?.alignmentReasoning || '',
    };

    // Normalize bdIntel (ensure scores are 0-100)
    const clampScore = (score: any): number => {
      const num = typeof score === 'number' ? score : parseInt(score) || 0;
      return Math.max(0, Math.min(100, num));
    };

    const bdIntel = {
      fitScore: clampScore(parsed.bdIntel?.fitScore),
      painAlignmentScore: clampScore(parsed.bdIntel?.painAlignmentScore),
      workflowFitScore: clampScore(parsed.bdIntel?.workflowFitScore),
      urgencyScore: clampScore(parsed.bdIntel?.urgencyScore),
      adoptionBarrierScore: clampScore(parsed.bdIntel?.adoptionBarrierScore),
      risks: normalizeArray(parsed.bdIntel?.risks),
      opportunities: normalizeArray(parsed.bdIntel?.opportunities),
      recommendedTalkTrack: parsed.bdIntel?.recommendedTalkTrack || null,
      recommendedSequence: parsed.bdIntel?.recommendedSequence || null,
      recommendedLeadSource: parsed.bdIntel?.recommendedLeadSource || null,
      finalSummary: parsed.bdIntel?.finalSummary || null,
    };

    return { persona, productFit, bdIntel };
  }

  /**
   * Save all three models to database
   */
  private static async saveToDatabase(
    parsed: { persona: any; productFit: any; bdIntel: any },
    companyHQId: string
  ): Promise<{ persona: any; productFit: any; bdIntel: any }> {
    // Validate required fields
    if (!parsed.persona.personName || !parsed.persona.title) {
      throw new Error('Persona personName and title are required');
    }

    if (!parsed.productFit.targetProductId) {
      throw new Error('ProductFit targetProductId is required');
    }

    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id: parsed.productFit.targetProductId },
    });

    if (!product) {
      throw new Error(`Product not found: ${parsed.productFit.targetProductId}`);
    }

    // Create Persona
    const persona = await prisma.persona.create({
      data: {
        companyHQId,
        personName: parsed.persona.personName,
        title: parsed.persona.title,
        headline: parsed.persona.headline,
        seniority: parsed.persona.seniority,
        industry: parsed.persona.industry,
        subIndustries: parsed.persona.subIndustries,
        company: parsed.persona.company,
        companySize: parsed.persona.companySize,
        annualRevenue: parsed.persona.annualRevenue,
        location: parsed.persona.location,
        description: parsed.persona.description,
        whatTheyWant: parsed.persona.whatTheyWant,
        painPoints: parsed.persona.painPoints,
        risks: parsed.persona.risks,
        decisionDrivers: parsed.persona.decisionDrivers,
        buyerTriggers: parsed.persona.buyerTriggers,
      },
    });

    console.log(`✅ Persona created: ${persona.id}`);

    // Create ProductFit
    const productFit = await prisma.productFit.upsert({
      where: { personaId: persona.id },
      create: {
        personaId: persona.id,
        productId: parsed.productFit.targetProductId,
        valuePropToThem: parsed.productFit.valuePropToThem,
        alignmentReasoning: parsed.productFit.alignmentReasoning,
      },
      update: {
        productId: parsed.productFit.targetProductId,
        valuePropToThem: parsed.productFit.valuePropToThem,
        alignmentReasoning: parsed.productFit.alignmentReasoning,
      },
    });

    console.log(`✅ ProductFit created/updated: ${productFit.id}`);

    // Create BdIntel
    const bdIntel = await prisma.bdIntel.upsert({
      where: { personaId: persona.id },
      create: {
        personaId: persona.id,
        fitScore: parsed.bdIntel.fitScore,
        painAlignmentScore: parsed.bdIntel.painAlignmentScore,
        workflowFitScore: parsed.bdIntel.workflowFitScore,
        urgencyScore: parsed.bdIntel.urgencyScore,
        adoptionBarrierScore: parsed.bdIntel.adoptionBarrierScore,
        risks: parsed.bdIntel.risks.length > 0 ? parsed.bdIntel.risks : null,
        opportunities: parsed.bdIntel.opportunities.length > 0 ? parsed.bdIntel.opportunities : null,
        recommendedTalkTrack: parsed.bdIntel.recommendedTalkTrack,
        recommendedSequence: parsed.bdIntel.recommendedSequence,
        recommendedLeadSource: parsed.bdIntel.recommendedLeadSource,
        finalSummary: parsed.bdIntel.finalSummary,
      },
      update: {
        fitScore: parsed.bdIntel.fitScore,
        painAlignmentScore: parsed.bdIntel.painAlignmentScore,
        workflowFitScore: parsed.bdIntel.workflowFitScore,
        urgencyScore: parsed.bdIntel.urgencyScore,
        adoptionBarrierScore: parsed.bdIntel.adoptionBarrierScore,
        risks: parsed.bdIntel.risks.length > 0 ? parsed.bdIntel.risks : null,
        opportunities: parsed.bdIntel.opportunities.length > 0 ? parsed.bdIntel.opportunities : null,
        recommendedTalkTrack: parsed.bdIntel.recommendedTalkTrack,
        recommendedSequence: parsed.bdIntel.recommendedSequence,
        recommendedLeadSource: parsed.bdIntel.recommendedLeadSource,
        finalSummary: parsed.bdIntel.finalSummary,
      },
    });

    console.log(`✅ BdIntel created/updated: ${bdIntel.id}`);

    return { persona, productFit, bdIntel };
  }
}

