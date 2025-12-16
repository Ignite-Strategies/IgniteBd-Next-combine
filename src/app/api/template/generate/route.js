import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
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

    const prompt = `You are a Business Development Relationship Manager. Your task is to create a human, low-pressure outreach message for maintaining or re-entering relationships.

=== CONTEXT ===
Relationship: ${relationship}
Type of Person: ${typeOfPerson}
Why Reaching Out: ${whyReachingOut}
${whatWantFromThem ? `What Want From Them: ${whatWantFromThem}` : 'What Want From Them: Not specified'}

=== YOUR TASK ===
Create a warm, human, low-pressure outreach message. Return ONLY valid JSON in this exact format:
{
  "content": "The full outreach message as a single paragraph or multiple sentences",
  "sections": {
    "opening": "Opening line that references whyReachingOut",
    "context": "Neutral context sentence based on relationship",
    "releaseValve": "A line that removes pressure (e.g., 'No agenda — just wanted to check in.')",
    "close": "Soft closing line"
  }
}

=== REQUIREMENTS ===
1. **Human & Natural**: Write like a real person, not a sales bot
2. **Low Pressure**: Always include a release valve that removes pressure
3. **No Sales Language**: No CTAs, no calendar links, no "let's hop on a call"
4. **Optional Feel**: Make it clear there's no obligation
5. **Reversible**: The recipient should feel they can easily decline or ignore

=== RELEASE VALVE EXAMPLES ===
- "No agenda — just wanted to check in."
- "No pressure at all."
- "Thought I'd reach out and say hello."
- "Just wanted to touch base — no expectations."

=== RELATIONSHIP TONE ===
- COLD: Friendly but acknowledge it's a first contact
- WARM: Reference the prior connection naturally
- ESTABLISHED: Casual, like checking in with a friend
- DORMANT: Acknowledge the gap but don't make it awkward

=== WHAT WANT FROM THEM ===
If provided, mention it softly at the end, but make it optional:
"If you're open to it, [whatWantFromThem]. But again, no pressure — just wanted to put it out there."

If not provided, use a simple friendly close like "Hope you're doing well!"

Return ONLY the JSON object, no markdown, no code blocks, no explanation.`;

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that returns only valid JSON. Never include markdown code blocks or explanations.',
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

    if (!parsed.sections) {
      parsed.sections = {
        opening: parsed.content.split('.')[0] || parsed.content,
        context: '',
        releaseValve: '',
        close: '',
      };
    }

    return NextResponse.json({
      success: true,
      message: parsed.content,
      sections: parsed.sections,
    });
  } catch (error) {
    console.error('❌ Template generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate template message' },
      { status: 500 },
    );
  }
}
