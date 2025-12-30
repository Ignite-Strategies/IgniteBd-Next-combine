/**
 * Template Relationship-Aware Service
 * 
 * Service for generating templates from structured relationship data
 * Used by: /api/template/generate-relationship-aware
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
 * Generate a template from relationship-aware data
 * 
 * @param {Object} options
 * @param {string} options.relationship - Familiarity level (COLD, WARM, ESTABLISHED, DORMANT)
 * @param {string} options.typeOfPerson - Type of person (CURRENT_CLIENT, FORMER_COWORKER, etc.)
 * @param {string} options.whyReachingOut - Why reaching out
 * @param {string} [options.whatWantFromThem] - What they want
 * @param {string} [options.timeSinceConnected] - Time since connected
 * @param {string} [options.timeHorizon] - Time horizon
 * @param {boolean} options.knowledgeOfBusiness - Do they know about the business
 * @param {string} [options.myBusinessDescription] - Business description
 * @param {string} [options.desiredOutcome] - Desired outcome
 * @param {string} [options.contextNotes] - Additional context notes
 * @param {string} options.ownerName - Owner's name for signature
 * @returns {Promise<{ title: string, subject: string, body: string }>}
 */
export async function generateTemplateFromRelationship({
  relationship,
  typeOfPerson,
  whyReachingOut,
  whatWantFromThem,
  timeSinceConnected,
  timeHorizon,
  knowledgeOfBusiness,
  myBusinessDescription,
  desiredOutcome,
  contextNotes,
  ownerName = '[Your name]',
}) {
  // Build relationship-aware logic
  let relationshipLogic = '';
  
  if (relationship === 'FRIEND_OF_FRIEND' || typeOfPerson === 'FRIEND_OF_FRIEND') {
    relationshipLogic += '- This is a FRIEND: Use casual, warm, personal tone. No business formality.\n';
  }
  
  if (relationship === 'ESTABLISHED') {
    relationshipLogic += '- This is an ESTABLISHED relationship: Write like checking in with a friend. Very casual.\n';
  }
  
  if (relationship === 'DORMANT' || (timeSinceConnected && timeSinceConnected.toLowerCase().includes('long'))) {
    relationshipLogic += '- This is a DORMANT relationship or LONG TIME since contact: MUST acknowledge the gap. Use phrases like "I know it\'s been a long time" or "Haven\'t connected in a while".\n';
  }
  
  if (relationship === 'WARM') {
    relationshipLogic += '- This is a WARM relationship: Reference the prior connection naturally.\n';
  }
  
  if (relationship === 'COLD') {
    relationshipLogic += '- This is a COLD relationship: Friendly but acknowledge it\'s a first contact.\n';
  }

  if (timeSinceConnected) {
    relationshipLogic += `- Time since connected: "${timeSinceConnected}" - Use this EXACTLY in the template to acknowledge the gap.\n`;
  }

  if (knowledgeOfBusiness) {
    relationshipLogic += '- They ALREADY KNOW about your business - no need to introduce it, just reference it naturally.\n';
  } else if (myBusinessDescription) {
    relationshipLogic += `- They DON'T KNOW about your business - introduce it naturally: "${myBusinessDescription}"\n`;
  }

  if (desiredOutcome) {
    relationshipLogic += `- Desired outcome: "${desiredOutcome}" - Present this clearly but with low pressure.\n`;
  } else if (whatWantFromThem) {
    relationshipLogic += `- What you want: "${whatWantFromThem}" - Present this clearly but with low pressure.\n`;
  }

  if (timeHorizon) {
    relationshipLogic += `- Time horizon: "${timeHorizon}" - Use this when mentioning when you want to connect.\n`;
  }

  if (contextNotes) {
    relationshipLogic += `- Additional context: "${contextNotes}" - Use this context to inform the tone and content of the message.\n`;
  }

  const prompt = `You are a Business Development Relationship Manager. Your task is to create a human, low-pressure outreach EMAIL TEMPLATE with DYNAMIC VARIABLES using relationship-aware logic.

=== RELATIONSHIP CONTEXT ===
Familiarity Level (relationship): ${relationship}
Relationship Type (typeOfPerson): ${typeOfPerson}
Why Reaching Out: ${whyReachingOut}
${whatWantFromThem ? `What Want From Them: ${whatWantFromThem}` : 'What Want From Them: Not specified'}

=== TEMPLATE CONTEXT ===
${timeSinceConnected ? `Time Since Connected: ${timeSinceConnected}` : 'Time Since Connected: Not specified'}
${timeHorizon ? `Time Horizon: ${timeHorizon}` : 'Time Horizon: Not specified'}
${myBusinessDescription ? `My Business: ${myBusinessDescription}` : 'My Business: Not specified'}
${desiredOutcome ? `Desired Outcome: ${desiredOutcome}` : 'Desired Outcome: Not specified'}
${contextNotes ? `Additional Context Notes: ${contextNotes}` : 'Additional Context Notes: Not specified'}
Knowledge of Business: ${knowledgeOfBusiness ? 'Yes, they know' : 'No, they don\'t know'}

=== RELATIONSHIP-AWARE LOGIC RULES ===
${relationshipLogic}

=== YOUR TASK ===
Create a warm, human, low-pressure outreach message template using VARIABLE TAGS for personalization.

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
1. **Title**: Create a simple descriptive title that infers variables (e.g., "Collaboration Outreach to Old Colleague", "Reconnecting with Former Co-worker", "Reaching Out to Prospect"). Keep it under 60 characters.
2. **Subject**: Create a simple, human email subject line WITHOUT variables. Should relate to the body content.
3. **Body**: The email body content with {{variables}} for personalization.
4. **Contact Variables**: Use {{variableName}} tags for contact-specific data:
   - {{firstName}} - Contact's first name
   - {{lastName}} - Contact's last name
   - {{fullName}} - Contact's full name
   - {{companyName}} - Their current company
   - {{title}} - Their job title
   - {{city}} - Their city
   - {{state}} - Their state
5. **Bake in Context**: Time, business description, desired outcome should be PLAIN TEXT (not {{variables}})
6. **Follow Logic Rules**: Apply the relationship-aware logic rules above
7. **Human & Natural**: Write like a real person, not a sales bot
8. **Low Pressure**: Always include a release valve that removes pressure
9. **No Sales Language**: No CTAs, no calendar links, no "let's hop on a call"
10. **Company Context**: Use {{companyName}} when relevant

=== TEMPLATE STRUCTURE ===
1. **Warm Greeting**: "Hi {{firstName}}," or similar
2. **Acknowledgment**: If DORMANT or long time, acknowledge the gap using timeSinceConnected
3. **Engagement**: Reference whyReachingOut naturally
4. **Context**: If needed, introduce business (if knowledgeOfBusiness is false)
5. **The Ask**: Present desiredOutcome or whatWantFromThem with low pressure
6. **Release Valve**: Include a line that removes pressure
7. **Soft Close**: Friendly closing

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

