import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { OpenAI } from 'openai';
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
    const { idea, ownerId } = body ?? {};

    if (!idea || idea.trim() === '') {
      return NextResponse.json(
        { error: 'idea is required' },
        { status: 400 },
      );
    }

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

    const prompt = `You are a Business Development Relationship Manager. Your task is to create a quick, warm, human outreach note from a simple idea.

=== USER'S IDEA ===
${idea.trim()}

=== YOUR TASK ===
1. **Infer the relationship** from the idea (COLD, WARM, ESTABLISHED, or DORMANT)
2. **Infer the ask** - what they want from the person (meeting, coffee, collaboration, etc.)
3. **Infer the general intent** - why they're reaching out
4. **Build a template** with this structure:
   - Title: Simple descriptive title that infers variables (e.g., "Collaboration Outreach to Old Colleague")
   - Subject: Simple, human subject line WITHOUT variables that relates to the body (e.g., "Reaching Out", "Reconnecting", "Collaboration in 2026")
   - Body: Warm welcome/greeting (use {{firstName}} variable)
   - Engagement line (reference why reaching out naturally)
   - The ask (what they want, low pressure)
   - Soft close with signature: "${ownerName}"

Return ONLY valid JSON in this exact format:
{
  "title": "Simple descriptive title that infers variables (e.g., 'Collaboration Outreach to Old Colleague')",
  "subject": "Simple, human subject line WITHOUT variables (e.g., 'Reaching Out', 'Reconnecting', 'Collaboration in 2026')",
  "body": "The email template with {{variableName}} tags"
}

IMPORTANT: 
- The "subject" field should be simple and relate to the body content (e.g., "Reaching Out", "Reconnecting", "Collaboration in 2026")
- Do NOT use variables like {{firstName}} in the subject line - that's spammy
- Do NOT use "[Your name]" in the content - use the provided signature: "${ownerName}"

=== TEMPLATE STRUCTURE ===
1. **Warm Welcome**: Start with "Hi {{firstName}}," or similar friendly greeting
2. **Engagement**: Reference why reaching out naturally (use inferred intent)
3. **The Ask**: Present what they want clearly but with low pressure
4. **Soft Close**: End with something friendly and optional-feeling

=== REQUIREMENTS ===
1. **Use Variables**: Use {{firstName}} for name, {{companyName}} if relevant
2. **Warm & Human**: Write like a real person, not a sales bot
3. **Low Pressure**: Make the ask feel optional and reversible
4. **Natural Flow**: Warm welcome → Engagement → Ask → Soft close
5. **No Sales Language**: No CTAs, no calendar links, no "let's hop on a call"
6. **Keep it Short**: This is a quick note, not a long email

=== RELATIONSHIP INFERENCE ===
- COLD = No prior relationship mentioned, first contact
- WARM = Some prior interaction or connection mentioned
- ESTABLISHED = Ongoing relationship (friend, current client, etc.)
- DORMANT = Had relationship but haven't connected in a while

=== EXAMPLES ===

Idea: "build me a quick note to a friend and tell him I want to meet"

Response:
{
  "title": "Reconnecting with Friend",
  "content": "Hi {{firstName}},\\n\\nHope you're doing well! Been thinking about you and wanted to reach out.\\n\\nWould love to catch up in person if you're open to it — maybe grab coffee or lunch?\\n\\nNo pressure at all, just thought it'd be nice to reconnect.\\n\\nLet me know if you're interested!\\n\\nCheers,\\n${ownerName}",
  "subject": "Reconnecting",
  "inferred": {
    "relationship": "ESTABLISHED",
    "ask": "meet for coffee or lunch",
    "intent": "Wanted to reconnect with a friend"
  },
  "suggestedVariables": ["firstName"]
}

Idea: "I want to reach out to my old coworker Sarah who I haven't talked to in 2 years. She moved to a new company and I'd love to catch up over coffee."

Response:
{
  "title": "Collaboration Outreach to Old Colleague",
  "content": "Hi {{firstName}},\\n\\nI know it's been a while since we connected — saw you moved to {{companyName}} and wanted to reach out!\\n\\nWould love to catch up over coffee if you're open to it. No pressure at all, just thought it'd be nice to reconnect.\\n\\nLet me know if you're interested!\\n\\nBest,\\n${ownerName}",
  "subject": "Reconnecting",
  "inferred": {
    "relationship": "DORMANT",
    "ask": "catch up over coffee",
    "intent": "Haven't connected in 2 years and saw they moved to a new company"
  },
  "suggestedVariables": ["firstName", "companyName"]
}

Now create a quick note template from this idea. Return ONLY the JSON object, no markdown, no code blocks, no explanation.`;

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates quick, warm outreach notes with variable tags. Return only valid JSON.',
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

    // Generate title if not provided
    let title = parsed.title;
    if (!title || typeof title !== 'string') {
      const inferred = parsed.inferred || {};
      if (inferred.ask) {
        if (inferred.ask.includes('collaboration')) {
          title = inferred.relationship === 'DORMANT' ? 'Collaboration Outreach to Old Colleague' : 'Collaboration Outreach';
        } else {
          title = inferred.relationship === 'DORMANT' ? 'Reconnecting with Former Colleague' : 'Reaching Out';
        }
      } else {
        title = 'AI Generated Template';
      }
    }

    // Generate subject if not provided (use simple default, NO variables)
    let subject = parsed.subject;
    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
      // Default to simple subject based on inferred ask
      const inferred = parsed.inferred || {};
      if (inferred.ask) {
        subject = inferred.ask.includes('collaboration') ? 'Collaboration in 2026' : 
                  inferred.relationship === 'DORMANT' ? 'Reconnecting' : 'Reaching Out';
      } else {
        subject = 'Reaching Out';
      }
    } else {
      // Clean up subject - remove variables, trim, ensure it's simple
      subject = subject.trim();
      // If subject contains variables or looks like a greeting, replace with simple subject
      if (subject.includes('{{') || subject.match(/^(Hi|Hey|Hello)[,\s]/i)) {
        const inferred = parsed.inferred || {};
        if (inferred.ask && inferred.ask.includes('collaboration')) {
          subject = 'Collaboration in 2026';
        } else if (inferred.relationship === 'DORMANT') {
          subject = 'Reconnecting';
        } else {
          subject = 'Reaching Out';
        }
      }
    }

    // Replace [Your name] with actual owner name in content if it exists
    let templateContent = parsed.content;
    if (ownerName && ownerName !== '[Your name]') {
      templateContent = templateContent.replace(/\[Your name\]/g, ownerName);
    }

    // Extract variables from content only (subject has no variables)
    const extractedVariablesFromContent = extractVariableNames(templateContent);
    
    // Merge with AI's suggested variables
    const allVariables = Array.from(
      new Set([
        ...extractedVariablesFromContent,
        ...(parsed.suggestedVariables || [])
      ])
    );

    return NextResponse.json({
      success: true,
      template: templateContent,
      title: title,
      subject: subject,
      inferred: parsed.inferred || {},
      variables: allVariables, // Simple string array
    });
  } catch (error) {
    console.error('❌ Template generate quick error:', error);
    return NextResponse.json(
      { error: 'Failed to generate quick template' },
      { status: 500 },
    );
  }
}

