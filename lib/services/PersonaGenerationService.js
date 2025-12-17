import { OpenAI } from 'openai';
import { prisma } from '../prisma';

// Initialize OpenAI (reads OPENAI_API_KEY from env automatically)
const openai = new OpenAI();

/**
 * Persona Generation Service
 * 
 * Generates structured persona data based on company and product information
 * Output aligns with Business Intelligence scoring requirements
 * 
 * @param {string} companyHQId - CompanyHQ ID
 * @param {string} productId - Product ID (optional)
 * @returns {Promise<Object>} Generated persona object
 */
export async function generatePersona(companyHQId, productId = null) {
  try {
    console.log(`🎯 Generating persona for CompanyHQ: ${companyHQId}, Product: ${productId || 'none'}`);

    // Fetch company and product data
    const [companyHQ, product] = await Promise.all([
      prisma.companyHQ.findUnique({
        where: { id: companyHQId },
        select: {
          companyName: true,
          companyIndustry: true,
          whatYouDo: true,
        },
      }),
      productId
        ? prisma.product.findUnique({
            where: { id: productId },
            select: {
              name: true,
              valueProp: true,
              description: true,
            },
          })
        : null,
    ]);

    if (!companyHQ) {
      throw new Error(`CompanyHQ not found: ${companyHQId}`);
    }

    // Build the user prompt
    const userPrompt = `Company:
Name: ${companyHQ.companyName}
Industry: ${companyHQ.companyIndustry || 'Not specified'}
What They Do: ${companyHQ.whatYouDo || 'Not specified'}

${product
  ? `Product:
Title: ${product.name}
Value Prop: ${product.valueProp || product.description || 'Not specified'}
Description: ${product.description || 'Not specified'}`
  : 'Product: Not specified (general company persona)'}

Generate a structured persona that represents the ideal buyer for this company/product combination.

Return ONLY a valid JSON object with these exact keys:
{
  "persona_name": "string (short descriptive label, e.g., 'Operations-Focused Director')",
  "ideal_roles": ["string"] (array of typical job titles or functions),
  "core_goals": ["string"] (array of what this person aims to achieve),
  "pain_points": ["string"] (array of blockers or frustrations they face),
  "value_prop": "string (the specific promise or benefit this product provides to that person)",
  "impact_statement": "string (one-sentence summary of how this product/value prop helps them succeed)"
}`;

    // System prompt
    const systemPrompt = `You are a Business Intelligence Persona Generator.

Your job is to create a detailed persona that represents the ideal buyer for a company's product or service offering.

The persona should:
1. Be specific to the company's industry and what they do
2. Focus on roles that would benefit from the product/value prop
3. Identify realistic goals and pain points for that role type
4. Clearly articulate how the product's value prop addresses their needs
5. Provide an impact statement that summarizes the value

Be specific, realistic, and focused on business outcomes. The persona will be used for matching contacts and scoring fit.

Return ONLY valid JSON. No markdown, no code blocks, just the JSON object.`;

    // Call OpenAI
    console.log('🤖 Calling OpenAI for persona generation...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
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
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No GPT output received.');
    }

    // Parse JSON response
    let personaData;
    try {
      personaData = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        personaData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate response structure
    const requiredKeys = [
      'persona_name',
      'ideal_roles',
      'core_goals',
      'pain_points',
      'value_prop',
      'impact_statement',
    ];

    for (const key of requiredKeys) {
      if (!(key in personaData)) {
        throw new Error(`Missing required key in response: ${key}`);
      }
    }

    // Ensure arrays are arrays
    if (!Array.isArray(personaData.ideal_roles)) {
      personaData.ideal_roles = [personaData.ideal_roles].filter(Boolean);
    }
    if (!Array.isArray(personaData.core_goals)) {
      personaData.core_goals = [personaData.core_goals].filter(Boolean);
    }
    if (!Array.isArray(personaData.pain_points)) {
      personaData.pain_points = [personaData.pain_points].filter(Boolean);
    }

    console.log(`✅ Persona generated successfully: ${personaData.persona_name}`);

    return {
      success: true,
      persona: personaData,
      rawResponse: content,
    };
  } catch (error) {
    console.error('❌ Persona Generation failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export default {
  generatePersona,
};

