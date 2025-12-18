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
    const { 
      relationship, 
      typeOfPerson, 
      whyReachingOut, 
      whatWantFromThem,
      // Template context fields
      timeSinceConnected,
      timeHorizon,
      knowledgeOfBusiness,
      myBusinessDescription,
      desiredOutcome,
    } = body ?? {};

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

=== TEMPLATE CONTEXT (Use these in the template content) ===
${timeSinceConnected ? `Time Since Connected: ${timeSinceConnected}` : 'Time Since Connected: Not specified'}
${timeHorizon ? `Time Horizon: ${timeHorizon}` : 'Time Horizon: Not specified'}
${myBusinessDescription ? `My Business: ${myBusinessDescription}` : 'My Business: Not specified'}
${desiredOutcome ? `Desired Outcome: ${desiredOutcome}` : 'Desired Outcome: Not specified'}
Knowledge of Business: ${knowledgeOfBusiness ? 'Yes, they know' : 'No, they don\'t know'}

=== YOUR TASK ===
Create a warm, human, low-pressure outreach message template using VARIABLE TAGS for personalization.

Return ONLY valid JSON in this exact format:
{
  "content": "The email template with {{variableName}} tags for dynamic content",
  "suggestedVariables": ["firstName", "companyName", "timeSinceConnected", etc.]
}

=== VARIABLE TAG FORMAT ===
Use {{variableName}} ONLY for contact-specific data that will be filled in later from the database.

**CONTACT VARIABLES** (use {{tags}} - these will be filled later):
- {{firstName}} - Contact's first name
- {{lastName}} - Contact's last name  
- {{companyName}} - Their current company
- {{title}} - Their job title

**TEMPLATE CONTEXT** (use provided values DIRECTLY as text, NOT as {{variables}}):
- Time Since Connected: "${timeSinceConnected || 'a while'}" - BAKE THIS INTO THE CONTENT
- Time Horizon: "${timeHorizon || 'soon'}" - BAKE THIS INTO THE CONTENT
- My Business: "${myBusinessDescription || 'my business'}" - BAKE THIS INTO THE CONTENT
- Desired Outcome: "${desiredOutcome || 'catch up'}" - BAKE THIS INTO THE CONTENT
- They ${knowledgeOfBusiness ? 'ALREADY KNOW' : 'DO NOT KNOW'} about your business - ADJUST INTRO ACCORDINGLY

=== REQUIREMENTS ===
1. **Contact Variables Only**: ONLY use {{variableName}} for firstName, lastName, companyName, title
2. **Bake in Context**: Time, business description, desired outcome should be PLAIN TEXT (not {{variables}})
3. **Human & Natural**: Write like a real person, not a sales bot
4. **Low Pressure**: Always include a release valve that removes pressure
5. **No Sales Language**: No CTAs, no calendar links, no "let's hop on a call"
6. **Greeting**: Always start with "Hi {{firstName}}," or similar
7. **Company Context**: Use {{companyName}} when relevant
8. **Signature**: End with a plain name like "Joel" or "Cheers, Joel"

=== EXAMPLE OUTPUT ===

If timeSinceConnected="a long time", timeHorizon="2026", myBusinessDescription="my own NDA house", desiredOutcome="see if we can collaborate and get some NDA work":

{
  "content": "Hi {{firstName}},\\n\\nI know it's been a long time since we connected. I saw you recently started working at {{companyName}}.\\n\\nNot sure if you knew, but I run my own NDA house.\\n\\nLet's get together in 2026 — see if we can collaborate and get some NDA work from you.\\n\\nNo pressure at all — just wanted to reach out.\\n\\nCheers to what's ahead!\\n\\nJoel",
  "suggestedVariables": ["firstName", "companyName"]
}

IMPORTANT: Only use {{variables}} for contact-specific data. Template context should be BAKED INTO the content as plain text.

=== RELATIONSHIP TONE ===
- COLD: Friendly but acknowledge it's a first contact
- WARM: Reference the prior connection naturally using the provided timeSinceConnected text
- ESTABLISHED: Casual, like checking in with a friend
- DORMANT: MUST acknowledge the gap using the provided timeSinceConnected text

=== WHAT WANT FROM THEM ===
If desiredOutcome provided, use it directly in the content:
"Let's get together in [timeHorizon] — [desiredOutcome]."

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
