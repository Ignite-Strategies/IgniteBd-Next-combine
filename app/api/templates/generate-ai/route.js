import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { OpenAI } from 'openai';
import { normalizeTemplateResponse, validateTemplateStructure } from '@/lib/templateNormalizer';
import { extractVariableNames } from '@/lib/templateVariables';

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
 * POST /api/templates/generate-ai
 * Generate email template from raw JSON/content using AI
 * 
 * Body:
 * {
 *   "title": "Optional existing title",
 *   "subject": "Optional existing subject",
 *   "body": "Optional existing body/content",
 *   "templateId": "Optional template ID for context"
 * }
 * 
 * Returns:
 * {
 *   "title": "Generated template title",
 *   "subject": "Generated email subject",
 *   "body": "Generated email body with {{variables}}"
 * }
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { title, subject, body: bodyText, templateId, ownerId } = body ?? {};

    // Get owner name for signature (if ownerId provided)
    let ownerName = '[Your name]';
    if (ownerId) {
      try {
        const { prisma } = await import('@/lib/prisma');
        const owner = await prisma.owners.findUnique({
          where: { id: ownerId },
          select: { firstName: true, lastName: true, name: true },
        });
        if (owner) {
          ownerName = owner.firstName || owner.name?.split(' ')[0] || '[Your name]';
        }
      } catch (err) {
        console.warn('Could not fetch owner name:', err);
      }
    }

    // Build context from provided content
    const hasContent = (title && title.trim()) || (subject && subject.trim()) || (bodyText && bodyText.trim());
    
    const prompt = `You are a Business Development Relationship Manager. Your task is to create or enhance an EMAIL TEMPLATE with DYNAMIC VARIABLES.

${hasContent ? `=== EXISTING CONTENT ===
${title ? `Title: ${title}` : ''}
${subject ? `Subject: ${subject}` : ''}
${bodyText ? `Body: ${bodyText}` : ''}

Based on the above content, enhance or complete the template.` : `Create a new email template from scratch.`}

=== YOUR TASK ===
Generate a complete email template with:
1. **Title**: A simple descriptive title that infers variables (e.g., "Collaboration Outreach to Old Colleague", "Reconnecting with Former Colleague", "Reaching Out to Prospect"). Keep it under 60 characters.
2. **Subject**: A simple, human email subject line WITHOUT variables. Should relate to the body content. Examples: "Reaching Out", "Reconnecting", "Collaboration in 2026". Do NOT use variables like {{firstName}} in the subject - that's spammy.
3. **Body**: The email body content with {{variables}} for personalization.

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
5. **Greeting**: Always start with "Hi {{firstName}}," or similar
6. **Company Context**: Use {{companyName}} when relevant
7. **Signature**: End with the provided signature: "${ownerName}" (NOT "[Your name]")

=== OUTPUT FORMAT ===
Return ONLY valid JSON in this exact format:
{
  "title": "Simple descriptive title that infers variables",
  "subject": "Simple subject line WITHOUT variables (e.g., 'Reaching Out', 'Reconnecting', 'Collaboration in 2026')",
  "body": "Email body content with {{variables}} like {{firstName}}, {{companyName}}, etc."
}

=== EXAMPLE OUTPUT ===
{
  "title": "Collaboration Outreach to Old Colleague",
  "subject": "Reconnecting",
  "body": "Hi {{firstName}},\\n\\nI hope this email finds you well. It's been a while since we connected, and I wanted to reach out.\\n\\nI saw you're now at {{companyName}} - congratulations on the new role!\\n\\nI'd love to catch up and see how things are going. No pressure at all, just thought it'd be nice to reconnect.\\n\\nBest,\\n${ownerName}"
}

Return ONLY the JSON object, no markdown, no code blocks, no explanation.`;

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates email templates with variable tags. Return only valid JSON.',
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

    // Normalize and parse the AI response using the normalizer function
    let normalized;
    try {
      // Try to parse as JSON first
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

      // Normalize the response to ensure consistent structure
      normalized = normalizeTemplateResponse(parsed);

      // Replace [Your name] with actual owner name if it exists
      if (ownerName && ownerName !== '[Your name]') {
        normalized.body = normalized.body.replace(/\[Your name\]/g, ownerName);
      }

      // Ensure subject is simple (no variables) - if it has variables, generate simple fallback
      if (normalized.subject && normalized.subject.includes('{{')) {
        // Extract simple subject from body context or use defaults
        if (normalized.body.toLowerCase().includes('collaboration')) {
          normalized.subject = 'Collaboration in 2026';
        } else if (normalized.body.toLowerCase().includes('reconnect') || normalized.body.toLowerCase().includes('long time')) {
          normalized.subject = 'Reconnecting';
        } else {
          normalized.subject = 'Reaching Out';
        }
      }

      // Validate the normalized structure
      if (!validateTemplateStructure(normalized)) {
        throw new Error('Normalized template structure is invalid');
      }
    } catch (error) {
      console.error('Error normalizing AI response:', error);
      throw new Error(`Failed to normalize AI response: ${error.message}`);
    }

    // Extract variables from body only (subject has no variables)
    const extractedVariablesFromBody = extractVariableNames(normalized.body);
    
    const allVariables = extractedVariablesFromBody;

    // Return structure matching the relationship-aware pattern
    return NextResponse.json({
      success: true,
      title: normalized.title,
      subject: normalized.subject,
      body: normalized.body,
      template: normalized.body, // Keep for backward compatibility
      variables: allVariables, // Simple string array
    });
  } catch (error) {
    console.error('❌ Template generate-ai error:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 },
    );
  }
}

