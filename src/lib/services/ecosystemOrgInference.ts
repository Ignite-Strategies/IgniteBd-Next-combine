/**
 * Ecosystem Organization Inference Service
 * AI-powered inference for ecosystem organizations (associations, commercial, media, etc.)
 */

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

export interface EcosystemOrgInferenceInput {
  name: string;
  website?: string;
  location?: string;
}

export interface EcosystemOrgInferenceResult {
  normalizedName: string;
  organizationType: 'ASSOCIATION' | 'COMMERCIAL' | 'MEDIA' | 'NONPROFIT' | 'GOVERNMENT';
  description: string;
  whatTheyDo: string;
  howTheyMatter: string;
  industryTags: string[];
  memberTypes: string[];
  authorityLevel: number; // 1-5
  sizeEstimate?: string;
  personaAlignment: Record<string, number>; // { personaId: score }
  bdRelevanceScore: number; // 0-100
}

/**
 * Run AI inference on ecosystem organization data
 */
export async function runEcosystemOrgInference(
  raw: EcosystemOrgInferenceInput
): Promise<EcosystemOrgInferenceResult> {
  try {
    console.log(`🤖 Running ecosystem org inference for: ${raw.name}`);

    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const prompt = `You are an ecosystem persona intelligence engine.

Given this organization:

Name: ${raw.name}
Website: ${raw.website || 'Not provided'}
Location: ${raw.location || 'Not provided'}

Infer and return ONLY JSON:
{
  "normalizedName": "Standardized name of the organization",
  "organizationType": "ASSOCIATION" | "COMMERCIAL" | "MEDIA" | "NONPROFIT" | "GOVERNMENT",
  "description": "Brief description of what the organization is",
  "whatTheyDo": "Detailed explanation of what activities, services, or functions this organization performs",
  "howTheyMatter": "Why this organization matters for business development - who attends, what value they provide, networking opportunities",
  "industryTags": ["array", "of", "relevant", "industry", "tags"],
  "memberTypes": ["array", "of", "member", "types", "e.g.", "companies", "individuals", "executives"],
  "authorityLevel": 1-5, // 1 = Local/Regional, 2 = State/Province, 3 = National, 4 = International, 5 = Global Authority
  "sizeEstimate": "Estimated size (e.g., '500-1000 members', '10,000+ attendees', '50-100 companies')",
  "personaAlignment": {}, // Empty object - will be populated later with persona scores
  "bdRelevanceScore": 0-100 // Business development relevance score based on member quality, networking opportunities, decision-maker density, etc.
}

Guidelines:
- organizationType: Determine if this is an ASSOCIATION (professional org), COMMERCIAL (for-profit event producer), MEDIA (media company), NONPROFIT (nonprofit org), or GOVERNMENT (gov agency)
- authorityLevel: 1 = Local/Regional, 2 = State/Province, 3 = National, 4 = International, 5 = Global Authority
- whatTheyDo: Be specific about their primary activities (e.g., "Hosts annual conferences for venture capital professionals", "Publishes industry reports on private equity trends")
- howTheyMatter: Explain BD value - who are the members/attendees, what networking opportunities exist, why this matters for business development
- bdRelevanceScore: Higher scores for orgs with decision-makers, high-quality networking, relevant industry focus, strong authority
- industryTags: Use specific, relevant tags (e.g., "Technology", "Healthcare", "Finance", "Private Equity", "Venture Capital")
- memberTypes: Be specific about what types of organizations or individuals typically engage (e.g., "C-Suite Executives", "Venture Capital Firms", "Startup Founders")
- sizeEstimate: Provide realistic estimates based on naming patterns, known organizations, or reasonable inferences`;

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3, // Lower temperature for more consistent, factual outputs
      messages: [
        {
          role: 'system',
          content:
            'You are an ecosystem persona intelligence engine specializing in business development ecosystems. Return only valid JSON. No markdown, no code blocks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    let result: any;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate and normalize result
    const validOrgTypes = ['ASSOCIATION', 'COMMERCIAL', 'MEDIA', 'NONPROFIT', 'GOVERNMENT'];
    const orgType = validOrgTypes.includes(result.organizationType) ? result.organizationType : 'COMMERCIAL';

    const inferenceResult: EcosystemOrgInferenceResult = {
      normalizedName: result.normalizedName || raw.name,
      organizationType: orgType as 'ASSOCIATION' | 'COMMERCIAL' | 'MEDIA' | 'NONPROFIT' | 'GOVERNMENT',
      description: result.description || '',
      whatTheyDo: result.whatTheyDo || result.description || '',
      howTheyMatter: result.howTheyMatter || 'Organization relevant to business development ecosystem',
      industryTags: Array.isArray(result.industryTags) ? result.industryTags : [],
      memberTypes: Array.isArray(result.memberTypes) ? result.memberTypes : [],
      authorityLevel: typeof result.authorityLevel === 'number' ? Math.max(1, Math.min(5, result.authorityLevel)) : 3,
      sizeEstimate: result.sizeEstimate || undefined,
      personaAlignment: typeof result.personaAlignment === 'object' ? result.personaAlignment : {},
      bdRelevanceScore: typeof result.bdRelevanceScore === 'number' ? Math.max(0, Math.min(100, result.bdRelevanceScore)) : 50,
    };

    console.log(`✅ Ecosystem org inference completed for: ${raw.name}`);

    return inferenceResult;
  } catch (error) {
    console.error(`❌ Ecosystem org inference failed for ${raw.name}:`, error);
    throw error;
  }
}

