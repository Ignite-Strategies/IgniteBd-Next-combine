/**
 * Template AI Generator Service
 * 
 * Service for generating templates from existing content (enhance/edit mode)
 * Used by: /api/templates/generate-ai
 * 
 * Returns: { title: string, subject: string, body: string }
 */

import { OpenAI } from 'openai';

// Initialize OpenAI client
let openaiClient = null;

function getOpenAIClient() {
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

/**
 * Generate or enhance a template using AI
 * 
 * @param {Object} options
 * @param {string} options.title - Optional existing title
 * @param {string} options.subject - Optional existing subject
 * @param {string} options.body - Optional existing body
 * @param {string} options.ownerName - Owner's name for signature
 * @returns {Promise<{ title: string, subject: string, body: string }>}
 */
export async function generateTemplateFromContent({ title, subject, body, ownerName = '[Your name]' }) {
  const hasContent = (title && title.trim()) || (subject && subject.trim()) || (body && body.trim());
  
  const prompt = `You are a Business Development Relationship Manager. Your task is to create or enhance an EMAIL TEMPLATE with DYNAMIC VARIABLES.

${hasContent ? `=== EXISTING CONTENT ===
${title ? `Title: ${title}` : ''}
${subject ? `Subject: ${subject}` : ''}
${body ? `Body: ${body}` : ''}

Based on the above content, enhance or complete the template.` : `Create a new email template from scratch.`}

=== YOUR TASK ===
Generate a complete email template with:
1. **Title**: A simple descriptive title that infers variables (e.g., "Collaboration Outreach to Old Colleague", "Reconnecting with Former Colleague", "Reaching Out to Prospect"). Keep it under 60 characters.
2. **Subject**: A simple, human email subject line WITHOUT variables. Should relate to the body content.
3. **Body**: The email body content with {{variables}} for personalization.

=== SUBJECT RULES (CRITICAL) ===
- Subject MUST NOT contain {{variables}}
- Subject MUST NOT contain greetings (Hi, Hello, Hey)
- Subject MUST be 2–6 words
- Subject MUST be a neutral human phrase (e.g. "Reaching Out", "Reconnecting", "Collaboration in 2026")

=== BODY RULES (CRITICAL) ===
- Body MUST start with a greeting using {{firstName}}
- Body MUST end with the exact signature: "${ownerName}"
- Do NOT include placeholders like [Your name]
- Do NOT include calendar links or CTAs

If you violate ANY rule, the output is considered invalid.

=== REQUIREMENTS ===
1. **Contact Variables**: Use {{variableName}} tags for contact-specific data:
   - {{firstName}} - Contact's first name
   - {{lastName}} - Contact's last name
   - {{fullName}} - Contact's full name
   - {{companyName}} - Their current company
   - {{title}} - Their job title
   - {{city}} - Their city
   - {{state}} - Their state

2. **Human & Natural**: Write like a real person, not a sales bot
3. **Low Pressure**: Always include a release valve that removes pressure
4. **No Sales Language**: No CTAs, no calendar links, no "let's hop on a call"
5. **Company Context**: Use {{companyName}} when relevant

=== OUTPUT FORMAT ===
CRITICAL: Return ONLY valid JSON in this exact format:
{
  "title": "Simple descriptive title that infers variables",
  "subject": "Simple subject line WITHOUT variables (e.g., 'Reaching Out', 'Reconnecting', 'Collaboration in 2026')",
  "body": "Email body content with {{variables}} like {{firstName}}, {{companyName}}, etc."
}

CRITICAL: Return ONLY the JSON object. Do not include markdown code blocks, explanations, or any text outside the JSON object.`;

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a deterministic email template generator. You MUST strictly follow all formatting and content rules. If any rule conflicts, prioritize JSON correctness and rule compliance over writing quality. Return only valid JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error('No response from AI');
  }

  // Parse JSON response
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (e) {
    // Try to extract JSON from markdown if AI wrapped it
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  // Validate required fields
  if (!parsed.title || typeof parsed.title !== 'string') {
    throw new Error('AI response missing title field');
  }
  if (!parsed.subject || typeof parsed.subject !== 'string') {
    throw new Error('AI response missing subject field');
  }
  if (!parsed.body || typeof parsed.body !== 'string') {
    throw new Error('AI response missing body field');
  }

  // Return validated response (prompt enforces correctness, no compensation needed)
  return {
    title: parsed.title.trim(),
    subject: parsed.subject.trim(),
    body: parsed.body.trim(),
  };
}

