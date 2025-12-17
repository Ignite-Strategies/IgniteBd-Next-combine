/**
 * BDOSPromptBuilder
 * 
 * Builds OpenAI prompts for BDOS v2 Intelligence scoring
 * Uses six-pillar model with weighted final score
 */

export interface BDOSPromptData {
  // Persona fit (0-100)
  personaFit: number;
  
  // Product fit (0-100)
  productFit: number;
  
  // Company readiness (0-100)
  companyReadiness: number;
  
  // Buying power (0-100)
  buyingPower: number;
  
  // Seniority (0-100)
  seniority: number;
  
  // Urgency (0-100)
  urgency: number;
  
  // Context data
  contactName: string;
  contactRole: string;
  contactOrg: string;
  productName: string;
  productValueProp: string;
  personaName?: string;
  personaGoals?: string;
  personaPainPoints?: string;
}

/**
 * Build system prompt for BDOS v2 scoring
 */
export function buildBDOSSystemPrompt(): string {
  return `You are the Business Development Operating System (BDOS v2).

Your goal is to produce a 6-pillar intelligence evaluation of a contact's readiness to adopt a product.

You receive:
- personaFit (0–100): How well the contact matches the target persona
- productFit (0–100): How well the product matches the contact's needs
- companyReadiness (0–100): Company health and growth indicators
- buyingPower (0–100): Contact's authority and company budget capacity
- seniority (0–100): Contact's seniority level and decision-making influence
- urgency (0–100): How urgent the contact's need is

You must:
1. Validate the scores logically (ensure they make sense together)
2. Combine them using BDOS weighting logic:
   finalScore = personaFit * 0.20 + productFit * 0.20 + companyReadiness * 0.20 + buyingPower * 0.15 + seniority * 0.10 + urgency * 0.15
3. Output a final_score (0–100)
4. Explain WHY in 3–5 bullet points
5. Return JSON only

Return exactly:
{
  "personaFit": <int>,
  "productFit": <int>,
  "companyReadiness": <int>,
  "buyingPower": <int>,
  "seniority": <int>,
  "urgency": <int>,
  "finalScore": <int>,
  "rationale": "<string>"
}`;
}

/**
 * Build user prompt for BDOS v2 scoring
 */
export function buildBDOSUserPrompt(data: BDOSPromptData): string {
  const personaSection = data.personaName
    ? `
PERSONA:
Name: ${data.personaName}
Goals: ${data.personaGoals || 'Not specified'}
Pain Points: ${data.personaPainPoints || 'Not specified'}
`
    : `
PERSONA: Not matched
`;

  return `
Evaluate the contact's readiness to adopt this product using the 6-pillar BDOS model.

CONTACT:
Name: ${data.contactName}
Role: ${data.contactRole}
Organization: ${data.contactOrg}

${personaSection}
PRODUCT:
Name: ${data.productName}
Value Proposition: ${data.productValueProp || 'Not specified'}

INTELLIGENCE SCORES:
- Persona Fit: ${data.personaFit}/100
- Product Fit: ${data.productFit}/100
- Company Readiness: ${data.companyReadiness}/100
- Buying Power: ${data.buyingPower}/100
- Seniority: ${data.seniority}/100
- Urgency: ${data.urgency}/100

Calculate the weighted final score and provide rationale.

Return ONLY valid JSON matching the schema provided in the system prompt.`;
}

