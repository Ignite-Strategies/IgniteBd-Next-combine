import { OpenAI } from 'openai';
import { prisma } from '../prisma';

// Initialize OpenAI client for Next.js
// In Next.js API routes, process.env is available on the server
let openaiClient = null;

function getOpenAIClient() {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not configured. Please set it in your environment variables.',
    );
  }

  openaiClient = new OpenAI({
    apiKey: apiKey,
  });

  return openaiClient;
}

/**
 * Business Intelligence Scoring Service
 * 
 * Evaluates how well a business offer (Product) matches a contact's current situation
 * Returns a 0-100 Fit Score with detailed breakdown
 * 
 * @param {string} contactId - Contact ID
 * @param {string} productId - Product ID (the "offer")
 * @param {string} personaId - Optional Persona ID (if contact is matched to a persona)
 * @returns {Promise<Object>} Scoring result with dimensions and total score
 */
export async function calculateFitScore(contactId, productId, personaId = null) {
  try {
    console.log(`🎯 Calculating Fit Score for Contact: ${contactId}, Product: ${productId}`);

    // Fetch all required data
    const [contact, product, pipeline, persona] = await Promise.all([
      prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          contactCompany: {
            select: {
              companyName: true,
              industry: true,
            },
          },
        },
      }),
      prisma.product.findUnique({
        where: { id: productId },
      }),
      prisma.pipeline.findUnique({
        where: { contactId },
      }),
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

    // Map fields to prompt template - using actual DB schema field names
    const contactName =
      contact.goesBy ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      'Unknown';
    const contactRole = contact.title || 'Not specified';
    const contactOrg =
      contact.contactCompany?.companyName || 'Not specified';
    
    // Get goals and pain points from persona (founder's manual input) or contact notes
    // These are stored as free text in DB - can include dashes, newlines, bullet points
    // OpenAI handles this formatted text just fine
    const contactGoals = persona?.goals || contact.notes || 'Not specified';
    const contactPainPoints = persona?.painPoints || 'Not specified';
    
    const budgetSensitivity = inferBudgetSensitivity(
      pipeline?.stage,
      pipeline?.pipeline,
    );
    const pipelineName = pipeline?.pipeline || 'Not specified';
    const stageName = pipeline?.stage || 'Not specified';
    const contactNotes = contact.notes || 'None';

    // Format product price for OpenAI prompt
    const offerPrice = product.price
      ? `${product.priceCurrency || 'USD'} ${product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'Not specified';

    // Build the user prompt - matching exact template structure
    // Free text fields (goals, painPoints) are inserted as-is - OpenAI handles formatted text well
    const userPrompt = `Offer:
Title: ${product.name}
Value Prop: ${product.valueProp || product.description || 'Not specified'}
Price: ${offerPrice}

Contact:
Name: ${contactName}
Role: ${contactRole}
Organization: ${contactOrg}
Goals: ${contactGoals}
Pain Points: ${contactPainPoints}
Budget Sensitivity: ${budgetSensitivity}
Pipeline: ${pipelineName}
Stage: ${stageName}
Notes: ${contactNotes}

Evaluate the fit and return ONLY a valid JSON object with these exact keys:
{
  "point_of_need": <0-20>,
  "pain_alignment": <0-20>,
  "willingness_to_pay": <0-20>,
  "impact_potential": <0-20>,
  "context_fit": <0-20>,
  "total_score": <sum of all five>,
  "summary": "<brief explanation>"
}`;

    // System prompt - matches exact template structure
    const systemPrompt = `You are a Business Intelligence Logic Scorer.

Your job is to evaluate how well a business offer matches a contact's current situation.

You will reason objectively and output a structured JSON object with numeric scores (0–100 total) and a summary.

Each dimension scores 0–20:

1. Point of Need — how directly the contact needs this offer.
2. Pain Alignment — how well the offer relieves known pains.
3. Willingness to Pay — likelihood of allocating budget at this stage.
4. Impact Potential — magnitude of improvement if adopted.
5. Context Fit — alignment with role, metrics, and pipeline stage.

Use these anchors:
0–5 = weak / irrelevant  
6–10 = partial  
11–15 = moderate  
16–20 = strong  

Compute total_score = sum(all five) and return JSON with keys:
{ point_of_need, pain_alignment, willingness_to_pay, impact_potential, context_fit, total_score, summary }

You must return valid JSON only. All scores must be integers between 0-20. The total_score must be the sum of all five dimension scores.`;

    // Call OpenAI
    // Using gpt-4o for better performance and cost efficiency
    // Can be overridden with OPENAI_MODEL env variable
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    console.log(`🤖 Calling OpenAI (${model}) for fit score calculation...`);
    
    // Get OpenAI client (validates API key is configured)
    const openai = getOpenAIClient();
    
    const completion = await openai.chat.completions.create({
      model: model,
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
      response_format: { type: 'json_object' }, // Ensure JSON response (requires gpt-4o, gpt-4-turbo, or gpt-3.5-turbo)
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No GPT output received.');
    }

    // Parse JSON response
    let scoringResult;
    try {
      scoringResult = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scoringResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate response structure
    const requiredKeys = [
      'point_of_need',
      'pain_alignment',
      'willingness_to_pay',
      'impact_potential',
      'context_fit',
      'total_score',
      'summary',
    ];

    for (const key of requiredKeys) {
      if (!(key in scoringResult)) {
        throw new Error(`Missing required key in response: ${key}`);
      }
    }

    // Ensure scores are within valid ranges
    const dimensionKeys = [
      'point_of_need',
      'pain_alignment',
      'willingness_to_pay',
      'impact_potential',
      'context_fit',
    ];

    for (const key of dimensionKeys) {
      const score = scoringResult[key];
      if (typeof score !== 'number' || score < 0 || score > 20) {
        console.warn(
          `⚠️ Invalid score for ${key}: ${score}. Clamping to 0-20 range.`,
        );
        scoringResult[key] = Math.max(0, Math.min(20, score));
      }
    }

    // Recalculate total_score to ensure accuracy
    scoringResult.total_score = dimensionKeys.reduce(
      (sum, key) => sum + (scoringResult[key] || 0),
      0,
    );

    // Ensure total_score is 0-100
    scoringResult.total_score = Math.max(0, Math.min(100, scoringResult.total_score));

    console.log(`✅ Fit Score calculated: ${scoringResult.total_score}/100`);

    return {
      success: true,
      contactId,
      productId,
      personaId,
      scores: {
        pointOfNeed: scoringResult.point_of_need,
        painAlignment: scoringResult.pain_alignment,
        willingnessToPay: scoringResult.willingness_to_pay,
        impactPotential: scoringResult.impact_potential,
        contextFit: scoringResult.context_fit,
        totalScore: scoringResult.total_score,
      },
      summary: scoringResult.summary,
      rawResponse: content,
    };
  } catch (error) {
    console.error('❌ Business Intelligence Scoring failed:', error);
    return {
      success: false,
      error: error.message,
      contactId,
      productId,
      personaId,
    };
  }
}

/**
 * Infer budget sensitivity from pipeline stage
 * This is a heuristic - can be enhanced with actual budget data later
 */
function inferBudgetSensitivity(stage, pipeline) {
  if (!stage || !pipeline) {
    return 'Unknown';
  }

  // Early stages = lower budget sensitivity
  const earlyStages = ['interest', 'meeting', 'proposal'];
  if (earlyStages.includes(stage.toLowerCase())) {
    return 'Low - Early stage';
  }

  // Contract stages = higher budget sensitivity
  const contractStages = [
    'contract',
    'contract-signed',
    'kickoff',
    'work-started',
  ];
  if (contractStages.includes(stage.toLowerCase())) {
    return 'High - Contract stage';
  }

  // Client pipeline = higher budget sensitivity
  if (pipeline.toLowerCase() === 'client') {
    return 'High - Existing client';
  }

  return 'Moderate';
}

/**
 * Find best matching persona for a contact
 * Matches based on role/title and industry
 * 
 * @param {string} contactId - Contact ID
 * @param {string} companyHQId - CompanyHQ ID (tenant)
 * @returns {Promise<string|null>} Persona ID or null
 */
export async function findMatchingPersona(contactId, companyHQId) {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        contactCompany: {
          select: {
            industry: true,
          },
        },
      },
    });

    if (!contact) {
      return null;
    }

    // Find personas for this tenant
    const personas = await prisma.persona.findMany({
      where: {
        companyHQId,
      },
    });

    if (personas.length === 0) {
      return null;
    }

    // Simple matching: try to match by title/role
    const contactTitle = (contact.title || '').toLowerCase();
    const contactIndustry =
      contact.contactCompany?.industry?.toLowerCase() || '';

    // Find best match
    let bestMatch = null;
    let bestScore = 0;

    for (const persona of personas) {
      let score = 0;

      // Match by role/title
      const personaRole = (persona.role || '').toLowerCase();
      const personaTitle = (persona.title || '').toLowerCase();
      if (
        contactTitle &&
        (personaRole.includes(contactTitle) ||
          contactTitle.includes(personaRole) ||
          personaTitle.includes(contactTitle))
      ) {
        score += 2;
      }

      // Match by industry
      const personaIndustry = (persona.industry || '').toLowerCase();
      if (
        contactIndustry &&
        personaIndustry &&
        personaIndustry.includes(contactIndustry)
      ) {
        score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = persona;
      }
    }

    return bestMatch?.id || null;
  } catch (error) {
    console.error('❌ Error finding matching persona:', error);
    return null;
  }
}

export default {
  calculateFitScore,
  findMatchingPersona,
};

