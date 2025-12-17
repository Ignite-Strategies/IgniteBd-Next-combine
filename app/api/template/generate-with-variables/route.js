import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { OpenAI } from 'openai';
import { extractVariables } from '@/lib/templateVariables';

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
    const { relationship, typeOfPerson, whyReachingOut, whatWantFromThem } = body ?? {};

    if (!relationship || !typeOfPerson || !whyReachingOut) {
      return NextResponse.json(
        { error: 'relationship, typeOfPerson, and whyReachingOut are required' },
        { status: 400 },
      );
    }

    const prompt = `You are a Business Development Relationship Manager. Your task is to create a human, low-pressure outreach EMAIL TEMPLATE with DYNAMIC VARIABLES.

=== CONTEXT ===
Relationship: ${relationship}
Type of Person: ${typeOfPerson}
Why Reaching Out: ${whyReachingOut}
${whatWantFromThem ? `What Want From Them: ${whatWantFromThem}` : 'What Want From Them: Not specified'}

=== YOUR TASK ===
Create a warm, human, low-pressure outreach message template using VARIABLE TAGS for personalization.

Return ONLY valid JSON in this exact format:
{
  "content": "The email template with {{variableName}} tags for dynamic content",
  "suggestedVariables": ["firstName", "companyName", "timeSinceConnected", etc.]
}

=== VARIABLE TAG FORMAT ===
Use {{variableName}} for any dynamic content that should be filled in later with contact-specific data.

Available variables you SHOULD use:
- {{firstName}} - Contact's first name
- {{lastName}} - Contact's last name  
- {{companyName}} - Their current company
- {{title}} - Their job title
- {{timeSinceConnected}} - How long since last contact (e.g., "2 years")
- {{timeHorizon}} - When to connect (e.g., "2026", "Q1 2025")
- {{knowledgeOfBusiness}} - Whether they know about your business
- {{myBusinessName}} - Your company/business name
- {{desiredOutcome}} - What you want from them
- {{myRole}} - Your name/role for signature

=== REQUIREMENTS ===
1. **Use Variable Tags**: Replace ALL contact-specific info with {{variableName}}
2. **Human & Natural**: Write like a real person, not a sales bot
3. **Low Pressure**: Always include a release valve that removes pressure
4. **No Sales Language**: No CTAs, no calendar links, no "let's hop on a call"
5. **Greeting**: Always start with "Hi {{firstName}}," or similar
6. **Time Context**: Use {{timeSinceConnected}} for dormant relationships
7. **Company Context**: Use {{companyName}} when relevant
8. **Your Business**: Use {{myBusinessName}} to reference your business
9. **Closing**: Sign off with {{myRole}} or a name variable

=== EXAMPLE OUTPUT ===
{
  "content": "Hi {{firstName}},\\n\\nI know it's been {{timeSinceConnected}} since we connected. I saw you recently started working at {{companyName}}.\\n\\nNot sure if you knew, but I run {{myBusinessName}}.\\n\\nLet's get together in {{timeHorizon}} — {{desiredOutcome}}.\\n\\nNo pressure at all — just wanted to reach out.\\n\\nCheers to what's ahead!\\n\\n{{myRole}}",
  "suggestedVariables": ["firstName", "timeSinceConnected", "companyName", "myBusinessName", "timeHorizon", "desiredOutcome", "myRole"]
}

=== RELATIONSHIP TONE ===
- COLD: Friendly but acknowledge it's a first contact, may not need {{timeSinceConnected}}
- WARM: Reference the prior connection naturally
- ESTABLISHED: Casual, like checking in with a friend
- DORMANT: MUST use {{timeSinceConnected}} to acknowledge the gap

=== WHAT WANT FROM THEM ===
If provided, use {{desiredOutcome}} variable in context like:
"Let's get together in {{timeHorizon}} — {{desiredOutcome}}."

If not provided, use a simple friendly close like "Let's catch up soon."

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

    // Validate and ensure required fields
    if (!parsed.content || typeof parsed.content !== 'string') {
      throw new Error('AI response missing content field');
    }

    // Extract variables from the generated content
    const extractedVariables = extractVariables(parsed.content);
    
    // Merge with AI's suggested variables
    const allVariables = Array.from(
      new Set([
        ...extractedVariables.map(v => v.name),
        ...(parsed.suggestedVariables || [])
      ])
    );

    return NextResponse.json({
      success: true,
      template: parsed.content,
      variables: extractedVariables,
      suggestedVariables: allVariables,
    });
  } catch (error) {
    console.error('❌ Template generate with variables error:', error);
    return NextResponse.json(
      { error: 'Failed to generate template with variables' },
      { status: 500 },
    );
  }
}
