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
    const { idea } = body ?? {};

    if (!idea || idea.trim() === '') {
      return NextResponse.json(
        { error: 'idea is required' },
        { status: 400 },
      );
    }

    const prompt = `You are a Business Development Relationship Manager. Your task is to parse a free-text outreach idea and infer the structured fields needed for an outreach template.

=== USER'S IDEA ===
${idea.trim()}

=== YOUR TASK ===
Analyze the idea and return ONLY valid JSON in this exact format:
{
  "relationship": "COLD" | "WARM" | "ESTABLISHED" | "DORMANT",
  "typeOfPerson": "CURRENT_CLIENT" | "FORMER_CLIENT" | "FORMER_COWORKER" | "PROSPECT" | "PARTNER" | "FRIEND_OF_FRIEND",
  "whyReachingOut": "A concise, human observation about why they're reaching out (1-2 sentences max)",
  "whatWantFromThem": "Optional: What they want from the person, or null if not mentioned"
}

=== RULES ===
1. **relationship**: 
   - COLD = No prior relationship, first contact
   - WARM = Some prior interaction or connection
   - ESTABLISHED = Ongoing relationship
   - DORMANT = Had relationship but haven't connected in a while

2. **typeOfPerson**:
   - CURRENT_CLIENT = Active client
   - FORMER_CLIENT = Past client
   - FORMER_COWORKER = Past colleague
   - PROSPECT = Potential client/business opportunity
   - PARTNER = Business partner
   - FRIEND_OF_FRIEND = Personal connection, friend

3. **whyReachingOut**: 
   - Must be a natural, human observation (1-2 sentences)
   - Examples: "Haven't connected in a while", "Saw you moved to a new firm", "Noticed your company was in the news"
   - Keep it conversational and specific to the idea

4. **whatWantFromThem**:
   - Only include if the idea mentions wanting something specific
   - Examples: "Would love to grab coffee", "Would be great to catch up"
   - If not mentioned, return null

5. Return ONLY the JSON object, no markdown, no code blocks, no explanation.

=== EXAMPLES ===

Idea: "I want to reach out to my old coworker Sarah who I haven't talked to in 2 years. She moved to a new company and I saw her post about it on LinkedIn. I'd love to catch up over coffee."

Response:
{
  "relationship": "DORMANT",
  "typeOfPerson": "FORMER_COWORKER",
  "whyReachingOut": "Haven't connected in a while and saw you moved to a new company",
  "whatWantFromThem": "Would love to catch up over coffee"
}

Idea: "Need to follow up with a prospect I met at a conference last month. They seemed interested in our services."

Response:
{
  "relationship": "WARM",
  "typeOfPerson": "PROSPECT",
  "whyReachingOut": "Met at a conference last month and wanted to follow up",
  "whatWantFromThem": null
}

Now parse this idea and return ONLY the JSON:`;

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
      temperature: 0.3,
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

    // Validate the parsed response
    const validRelationships = ['COLD', 'WARM', 'ESTABLISHED', 'DORMANT'];
    const validTypes = ['CURRENT_CLIENT', 'FORMER_CLIENT', 'FORMER_COWORKER', 'PROSPECT', 'PARTNER', 'FRIEND_OF_FRIEND'];

    if (!validRelationships.includes(parsed.relationship)) {
      parsed.relationship = 'WARM'; // Default fallback
    }
    if (!validTypes.includes(parsed.typeOfPerson)) {
      parsed.typeOfPerson = 'PROSPECT'; // Default fallback
    }
    if (!parsed.whyReachingOut || typeof parsed.whyReachingOut !== 'string') {
      parsed.whyReachingOut = idea.trim(); // Fallback to original idea
    }
    if (parsed.whatWantFromThem !== null && (!parsed.whatWantFromThem || typeof parsed.whatWantFromThem !== 'string')) {
      parsed.whatWantFromThem = null;
    }

    return NextResponse.json({
      success: true,
      inferredFields: {
        relationship: parsed.relationship,
        typeOfPerson: parsed.typeOfPerson,
        whyReachingOut: parsed.whyReachingOut.trim(),
        whatWantFromThem: parsed.whatWantFromThem?.trim() || null,
      },
    });
  } catch (error) {
    console.error('❌ Template parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse template idea' },
      { status: 500 },
    );
  }
}
