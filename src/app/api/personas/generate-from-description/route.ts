import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { OpenAI } from 'openai';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
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
 * POST /api/personas/generate-from-description
 * 
 * Generate a persona from a free-form description
 * 
 * Body:
 * {
 *   "description": "A solo business owner who...",
 *   "companyHQId": "xxx" (required)
 * }
 * 
 * Returns: Generated persona data (not saved to DB)
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { description, companyHQId } = body;

    if (!description || !description.trim()) {
      return NextResponse.json(
        { success: false, error: 'description is required' },
        { status: 400 },
      );
    }

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Fetch company context for better generation
    const companyHQ = await prisma.companyHQ.findUnique({
      where: { id: companyHQId },
      select: {
        companyName: true,
        companyIndustry: true,
        whatYouDo: true,
      },
    });

    // Build OpenAI prompt
    const systemPrompt = `You are an expert in executive psychology and business persona modeling. 
Given a description of an ideal customer, generate a detailed, structured persona.

Infer from the description:
- their role and seniority
- their industry and company context
- their responsibilities and pressures
- what they optimize for
- what risks they manage
- how they decide

Return JSON ONLY in this exact structure:
{
  "personName": "",
  "title": "",
  "headline": "",
  "seniority": "",
  "industry": "",
  "subIndustries": [],
  "company": "",
  "companySize": "",
  "annualRevenue": "",
  "location": "",
  "description": "",
  "whatTheyWant": "",
  "painPoints": [],
  "risks": [],
  "decisionDrivers": [],
  "buyerTriggers": [],
  "goals": ""
}`;

    const userPrompt = `Company Context:
${companyHQ ? `Name: ${companyHQ.companyName}
Industry: ${companyHQ.companyIndustry || 'Not specified'}
What They Do: ${companyHQ.whatYouDo || 'Not specified'}` : 'No company context provided'}

Description of Ideal Customer:
${description.trim()}

Generate a detailed persona from this description.`;

    // Call OpenAI
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    
    console.log(`🤖 Calling OpenAI (${model}) for persona generation from description...`);
    
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No GPT output received');
    }

    // Parse JSON response
    let personaData;
    try {
      personaData = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        personaData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Ensure arrays are arrays
    if (personaData.painPoints && !Array.isArray(personaData.painPoints)) {
      personaData.painPoints = typeof personaData.painPoints === 'string' 
        ? personaData.painPoints.split('\n').filter(Boolean)
        : [personaData.painPoints];
    }
    if (personaData.goals && !Array.isArray(personaData.goals)) {
      personaData.goals = typeof personaData.goals === 'string'
        ? personaData.goals.split('\n').filter(Boolean)
        : [personaData.goals];
    }

    console.log(`✅ Persona generated from description: ${personaData.personName || 'Unnamed'}`);

    return NextResponse.json({
      success: true,
      persona: personaData,
      companyHQId,
    });
  } catch (error: any) {
    console.error('❌ Generate persona from description error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate persona',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

