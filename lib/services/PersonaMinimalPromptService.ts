/**
 * PersonaMinimalPromptService
 * 
 * Builds the actual AI prompt for minimal persona generation
 * Matches the pattern used in TemplateAIGeneratorService:
 * - Explicit system prompt with strict JSON requirements
 * - Detailed user prompt with context
 * - Clear output format specification
 * - Validation-ready structure
 */

import { PreparedData } from './PersonaPromptPrepService';

export interface PromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export class PersonaMinimalPromptService {
  /**
   * Build prompts for minimal persona generation
   * Follows the template service pattern for consistency
   */
  static buildPrompts(data: PreparedData, description?: string): PromptResult {
    const { contact, companyHQ } = data;

    // System prompt: Explicit, deterministic, JSON-focused
    const systemPrompt = `You are a deterministic business persona generator. You MUST strictly follow all formatting and content rules. If any rule conflicts, prioritize JSON correctness and rule compliance over writing quality. Return only valid JSON. Never include markdown code blocks, explanations, or any text outside the JSON object.`;

    // Build contact context section
    let contactContext = '';
    if (contact) {
      const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      contactContext = `=== CONTACT INFORMATION ===
Name: ${fullName || 'Not specified'}
Title: ${contact.title || 'Not specified'}
Company: ${contact.companyName || 'Not specified'}
Industry: ${contact.companyIndustry || 'Not specified'}`;
    } else if (description) {
      contactContext = `=== DESCRIPTION ===
${description}`;
    }

    // User prompt: Explicit format requirements matching template service pattern
    const userPrompt = `You are an expert in business persona modeling. Your task is to generate a MINIMAL persona based on the provided context.

=== COMPANY CONTEXT ===
Company Name: ${companyHQ.companyName}
Industry: ${companyHQ.companyIndustry || 'Not specified'}
What We Do: ${companyHQ.whatYouDo || 'Not specified'}

${contactContext ? `${contactContext}\n` : ''}

=== YOUR TASK ===
Generate a minimal persona with just the essentials:
1. **personName**: A clear identifier/archetype (e.g., "Compliance Manager", "Deputy Counsel", "Operations Director")
   - Should be a role archetype, NOT the actual person's name
   - Should reflect their function/role type
2. **title**: Their job title/role (e.g., "Deputy Counsel", "Compliance Manager at X Firm")
   - Can be more specific than personName
   - Should reflect their actual or inferred title
3. **company**: Company name or company type/archetype (e.g., "X Firm", "Mid-size Asset Manager", "B2B SaaS Company")
   - Use actual company name if available, otherwise infer type
4. **coreGoal**: Their main goal/north star
   - MUST be exactly ONE sentence
   - NO bullet points, NO semicolons
   - Maximum ~25 words
   - Should be a single, clear statement of their primary objective
   - Should be role/industry-appropriate
   - Should be actionable and specific

=== OUTPUT FORMAT ===
CRITICAL: Return ONLY valid JSON in this exact format:
{
  "personName": "string (role archetype, e.g., 'Compliance Manager')",
  "title": "string (job title/role, e.g., 'Deputy Counsel')",
  "company": "string (company name or type, e.g., 'X Firm')",
  "coreGoal": "string (one sentence describing their main goal/north star)"
}

=== PRIORITY RULES (CRITICAL) ===
1. **Data Precedence**: If real contact or company data is provided, it MUST be used exactly as provided
   - NEVER replace provided factual data with inferred data
   - NEVER use archetyping when real data exists
   - Inference or archetyping is allowed ONLY when data is missing or incomplete
   - Example: If contact title is "Deputy Counsel", use "Deputy Counsel" - do NOT infer "Legal Manager"

2. **personName Semantics (CRITICAL)**:
   - personName MUST be a role archetype label (e.g., "Compliance Manager", "Operations Director")
   - NEVER use a real person's name (e.g., "John Smith" is INVALID)
   - NEVER imply a specific individual
   - Always return a role/archetype label that represents the function, not the person

=== REQUIREMENTS ===
1. **personName**: Must be a role archetype label, NEVER the actual contact's name or any individual identifier
2. **title**: MUST use the contact's actual title if provided in context. Only infer if title is missing or "Not specified"
3. **company**: MUST use the actual company name from context if provided. Only infer company type if company name is missing or "Not specified"
4. **coreGoal**: 
   - MUST be exactly ONE sentence
   - NO bullet points
   - NO semicolons
   - Maximum ~25 words
   - Specific to their role and industry context
5. **All fields required**: Every field must have a non-empty string value
6. **Be specific**: Avoid generic placeholders - use the context to infer realistic values when data is missing

=== EXAMPLES ===

If contact is "John Smith, Deputy Counsel at X Firm":
{
  "personName": "Compliance Manager",
  "title": "Deputy Counsel",
  "company": "X Firm",
  "coreGoal": "Ensure regulatory compliance while minimizing operational overhead and legal risk."
}

If contact is "Jane Doe, Operations Director at TechCorp":
{
  "personName": "Operations Director",
  "title": "Operations Director",
  "company": "TechCorp",
  "coreGoal": "Streamline operational processes to improve efficiency and reduce costs while maintaining quality standards."
}

CRITICAL: Return ONLY the JSON object. Do not include markdown code blocks, explanations, or any text outside the JSON object.`;

    return { systemPrompt, userPrompt };
  }
}

