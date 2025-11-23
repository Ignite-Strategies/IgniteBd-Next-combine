/**
 * BDOSScoringService
 * 
 * BDOS v2 Intelligence Engine
 * Calculates six-pillar intelligence scores with weighted final score
 */

import { OpenAI } from 'openai';
import { prisma } from '../prisma';
import { findMatchingPersona } from '../services/BusinessIntelligenceScoringService';
import { computeContactIntelligence } from './ContactIntelligenceService';
import { computeCompanyReadiness } from './CompanyIntelligenceService';
import { buildBDOSSystemPrompt, buildBDOSUserPrompt, type BDOSPromptData } from './BDOSPromptBuilder';

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

export interface BDOSScoreResult {
  success: boolean;
  contactId: string;
  productId: string;
  personaId: string | null;
  scores: {
    personaFit: number;
    productFit: number;
    companyReadiness: number;
    buyingPower: number;
    seniority: number;
    urgency: number;
    totalScore: number;
  };
  rationale?: string;
  error?: string;
}

/**
 * Calculate persona fit score (0-100)
 * Simple heuristic based on persona matching confidence
 */
function calculatePersonaFit(personaId: string | null, contactId: string, companyHQId: string): number {
  if (!personaId) {
    return 0;
  }

  // Use findMatchingPersona to get confidence
  // For now, return a simple score - can be enhanced
  return 75; // Default if persona matched
}

/**
 * Calculate product fit score (0-100)
 * Simple heuristic based on product attributes vs contact needs
 */
function calculateProductFit(product: any, contact: any, persona: any): number {
  // Base score
  let score = 50;

  // If persona has pain points and product addresses them
  if (persona?.painPoints && product?.valueProp) {
    const painPointsText = Array.isArray(persona.painPoints)
      ? persona.painPoints.join(' ').toLowerCase()
      : (persona.painPoints || '').toLowerCase();
    const valuePropText = (product.valueProp || '').toLowerCase();

    // Simple keyword matching
    const painKeywords = painPointsText.split(/\s+/).filter(w => w.length > 4);
    const matchingKeywords = painKeywords.filter(k => valuePropText.includes(k));
    
    if (matchingKeywords.length > 0) {
      score += Math.min(30, matchingKeywords.length * 5);
    }
  }

  // If product is targeted to this persona
  if (persona && product?.targetedTo === persona.id) {
    score += 20;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate BDOS Score (six-pillar model)
 * 
 * @param contactId - Contact ID
 * @param productId - Product ID
 * @param personaId - Optional Persona ID (auto-matched if not provided)
 * @returns BDOS score result
 */
export async function calculateBDOSScore(
  contactId: string,
  productId: string,
  personaId: string | null = null
): Promise<BDOSScoreResult> {
  try {
    console.log(`🎯 Calculating BDOS Score for Contact: ${contactId}, Product: ${productId}`);

    // Fetch all required data
    const [contact, product, company, persona] = await Promise.all([
      prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          contactCompany: true,
        },
      }),
      prisma.product.findUnique({
        where: { id: productId },
      }),
      prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          contactCompany: true,
        },
      }).then(c => c?.contactCompany || null),
      personaId
        ? prisma.persona.findUnique({
            where: { id: personaId },
          })
        : null,
    ]);

    // Validate required data
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // Auto-match persona if not provided
    let finalPersonaId = personaId;
    let finalPersona = persona;
    if (!finalPersonaId) {
      const matchResult = await findMatchingPersona(contactId, contact.crmId, { returnDetails: true });
      // matchResult is an object when returnDetails: true, or string/null when false
      // Type guard to handle the object case
      if (matchResult && typeof matchResult === 'object' && !Array.isArray(matchResult) && 'personaId' in matchResult) {
        finalPersonaId = (matchResult as { personaId: string | null }).personaId || null;
      } else {
        finalPersonaId = null;
      }
      if (finalPersonaId) {
        // Fetch the matched persona
        finalPersona = await prisma.persona.findUnique({
          where: { id: finalPersonaId },
        });
      }
    }

    // Get intelligence scores
    const contactIntelligence = computeContactIntelligence(contact);
    const companyReadiness = company ? computeCompanyReadiness(company) : 0;

    // Calculate fit scores
    const personaFit = calculatePersonaFit(finalPersonaId, contactId, contact.crmId);
    const productFit = calculateProductFit(product, contact, finalPersona);

    // Build prompt data
    const contactName =
      contact.goesBy ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      'Unknown';
    const contactRole = contact.title || 'Not specified';
    const contactOrg = contact.contactCompany?.companyName || 'Not specified';

    const promptData: BDOSPromptData = {
      personaFit,
      productFit,
      companyReadiness,
      buyingPower: contactIntelligence.buyingPower,
      seniority: contactIntelligence.seniority,
      urgency: contactIntelligence.urgency,
      contactName,
      contactRole,
      contactOrg,
      productName: product.name,
      productValueProp: product.valueProp || product.description || 'Not specified',
      personaName: finalPersona?.personName || undefined,
      personaGoals: finalPersona?.whatTheyWant || undefined,
      personaPainPoints: Array.isArray(finalPersona?.painPoints)
        ? finalPersona.painPoints.join(', ')
        : undefined,
    };

    // Build prompts
    const systemPrompt = buildBDOSSystemPrompt();
    const userPrompt = buildBDOSUserPrompt(promptData);

    // Call OpenAI
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    console.log(`🤖 Calling OpenAI (${model}) for BDOS score calculation...`);

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No GPT output received');
    }

    // Parse JSON response
    let scoringResult: any;
    try {
      scoringResult = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scoringResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate response structure
    const requiredKeys = [
      'personaFit',
      'productFit',
      'companyReadiness',
      'buyingPower',
      'seniority',
      'urgency',
      'finalScore',
      'rationale',
    ];

    for (const key of requiredKeys) {
      if (!(key in scoringResult)) {
        throw new Error(`Missing required key in response: ${key}`);
      }
    }

    // Ensure scores are within valid ranges
    const dimensionKeys = [
      'personaFit',
      'productFit',
      'companyReadiness',
      'buyingPower',
      'seniority',
      'urgency',
    ];

    for (const key of dimensionKeys) {
      const score = scoringResult[key];
      if (typeof score !== 'number' || score < 0 || score > 100) {
        console.warn(`⚠️ Invalid score for ${key}: ${score}. Clamping to 0-100 range.`);
        scoringResult[key] = Math.max(0, Math.min(100, score));
      }
    }

    // Ensure finalScore is 0-100
    scoringResult.finalScore = Math.max(0, Math.min(100, scoringResult.finalScore));

    // Store BDOSScore record
    // Note: Prisma client converts model name to camelCase (BDOSScore -> bDOSScore)
    const bdosScore = await prisma.bDOSScore.create({
      data: {
        contactId,
        productId,
        personaId: finalPersonaId,
        totalScore: scoringResult.finalScore,
        personaFit: scoringResult.personaFit,
        productFit: scoringResult.productFit,
        companyReadiness: scoringResult.companyReadiness,
        buyingPower: scoringResult.buyingPower,
        seniority: scoringResult.seniority,
        urgency: scoringResult.urgency,
        rationale: scoringResult.rationale || null,
        rawResponse: scoringResult as any,
      },
    });

    console.log(`✅ BDOS Score calculated: ${scoringResult.finalScore}/100`);

    return {
      success: true,
      contactId,
      productId,
      personaId: finalPersonaId,
      scores: {
        personaFit: scoringResult.personaFit,
        productFit: scoringResult.productFit,
        companyReadiness: scoringResult.companyReadiness,
        buyingPower: scoringResult.buyingPower,
        seniority: scoringResult.seniority,
        urgency: scoringResult.urgency,
        totalScore: scoringResult.finalScore,
      },
      rationale: scoringResult.rationale,
    };
  } catch (error: any) {
    console.error('❌ BDOS Scoring failed:', error);
    return {
      success: false,
      contactId,
      productId,
      personaId,
      scores: {
        personaFit: 0,
        productFit: 0,
        companyReadiness: 0,
        buyingPower: 0,
        seniority: 0,
        urgency: 0,
        totalScore: 0,
      },
      error: error.message || 'Failed to calculate BDOS score',
    };
  }
}

