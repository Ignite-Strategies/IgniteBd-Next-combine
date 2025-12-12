import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
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
 * POST /api/workme/presentations/outline-ai
 * Generate presentation outline from idea using AI
 * 
 * Body:
 * {
 *   "idea": "string",
 *   "slideCount": number
 * }
 * 
 * Returns:
 * {
 *   "outline": [
 *     {
 *       "title": "string",
 *       "bullets": ["...", "..."]
 *     }
 *   ]
 * }
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
    const { idea, slideCount } = body;

    if (!idea || typeof idea !== 'string' || idea.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'idea is required' },
        { status: 400 },
      );
    }

    if (!slideCount || typeof slideCount !== 'number' || slideCount < 1) {
      return NextResponse.json(
        { success: false, error: 'slideCount must be a positive number' },
        { status: 400 },
      );
    }

    // Build OpenAI prompt
    const systemPrompt = `You are an expert presentation strategist. 
Given a presentation idea and target slide count, generate a structured outline with a compelling title and description.

Return JSON ONLY in this exact structure:
{
  "title": "Compelling presentation title based on the idea",
  "description": "Brief 1-2 sentence description of what this presentation covers",
  "outline": [
    {
      "title": "Slide title",
      "bullets": ["Key point 1", "Key point 2", "Key point 3"]
    }
  ]
}

Requirements:
- Title: Should be engaging, professional, and clearly communicate the presentation topic
- Description: 1-2 sentences summarizing the presentation's purpose and value
- Each slide should have:
  - A clear, actionable title
  - 2-4 bullet points that support the title
  - Logical flow from introduction to conclusion`;

    const userPrompt = `Generate a ${slideCount}-slide presentation outline for:

${idea}

Create a compelling structure that flows logically from introduction through key points to conclusion.`;

    // Call OpenAI
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    
    console.log(`🤖 Calling OpenAI (${model}) for presentation outline...`);
    
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
    let outlineData;
    try {
      outlineData = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        outlineData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate outline structure
    if (!outlineData.outline || !Array.isArray(outlineData.outline)) {
      return NextResponse.json(
        { success: false, error: 'Invalid outline structure from AI' },
        { status: 500 },
      );
    }

    // Ensure we have the right number of slides (trim or pad if needed)
    const outline = outlineData.outline.slice(0, slideCount);
    while (outline.length < slideCount) {
      outline.push({
        title: `Slide ${outline.length + 1}`,
        bullets: ['Content to be added'],
      });
    }

    // Extract title and description (with fallbacks)
    const title = outlineData.title || idea.split(' ').slice(0, 5).join(' ') + ' Presentation';
    const description = outlineData.description || `A presentation about ${idea}`;

    console.log(`✅ Generated ${outline.length} slide outline with title: "${title}"`);

    return NextResponse.json({
      success: true,
      title,
      description,
      outline,
    });
  } catch (error: any) {
    console.error('❌ Presentation outline generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate presentation outline',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

