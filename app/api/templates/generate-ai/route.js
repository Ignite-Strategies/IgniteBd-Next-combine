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
    const { title, subject, body: bodyText, templateId } = body ?? {};

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
1. **Title**: A concise, descriptive title (e.g., "Reconnecting with Former Colleague", "Outreach to Prospect"). Keep it under 60 characters.
2. **Subject**: A warm, personal email subject line. Should feel human and natural. Can use {{variables}} like {{firstName}}. Keep it under 80 characters. Examples: "Hi {{firstName}}, long time no see" or "Quick check-in, {{firstName}}".
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
7. **Signature**: End with a plain name like "Best," or "Cheers,"

=== OUTPUT FORMAT ===
Return ONLY valid JSON in this exact format:
{
  "title": "Template title",
  "subject": "Email subject line with optional {{variables}}",
  "body": "Email body content with {{variables}} like {{firstName}}, {{companyName}}, etc."
}

=== EXAMPLE OUTPUT ===
{
  "title": "Reconnecting with Former Colleague",
  "subject": "Hi {{firstName}}, long time no see",
  "body": "Hi {{firstName}},\\n\\nI hope this email finds you well. It's been a while since we connected, and I wanted to reach out.\\n\\nI saw you're now at {{companyName}} - congratulations on the new role!\\n\\nI'd love to catch up and see how things are going. No pressure at all, just thought it'd be nice to reconnect.\\n\\nBest,\\n[Your Name]"
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

      // Validate the normalized structure
      if (!validateTemplateStructure(normalized)) {
        throw new Error('Normalized template structure is invalid');
      }
    } catch (error) {
      console.error('Error normalizing AI response:', error);
      throw new Error(`Failed to normalize AI response: ${error.message}`);
    }

    // Extract variables from both subject and body
    const extractedVariablesFromBody = extractVariableNames(normalized.body);
    const extractedVariablesFromSubject = extractVariableNames(normalized.subject);
    
    // Merge all variables
    const allVariables = Array.from(
      new Set([
        ...extractedVariablesFromBody,
        ...extractedVariablesFromSubject,
      ])
    );

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

