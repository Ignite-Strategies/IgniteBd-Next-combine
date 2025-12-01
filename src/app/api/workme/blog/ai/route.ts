import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { OpenAI } from 'openai';
import type { BlogIngest, BlogDraft } from '@/lib/blog-engine/types';

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
 * POST /api/workme/blog/ai
 * Generate blog content from BlogIngest using AI
 * 
 * Body:
 * {
 *   "blogIngest": BlogIngest
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "blogDraft": BlogDraft
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
    const { blogIngest } = body;

    if (!blogIngest) {
      return NextResponse.json(
        { success: false, error: 'blogIngest is required' },
        { status: 400 },
      );
    }

    if (blogIngest.mode !== 'persona') {
      return NextResponse.json(
        { success: false, error: 'Only persona mode is supported in v1' },
        { status: 400 },
      );
    }

    if (!blogIngest.persona || !blogIngest.topic || !blogIngest.problem) {
      return NextResponse.json(
        { success: false, error: 'persona, topic, and problem are required' },
        { status: 400 },
      );
    }

    // Build the AI prompt using the specified format
    const prompt = `
You are a Business Development and Legal Content Strategist for BusinessPoint Law.

Your task: 
Generate a structured BlogDraft JSON object based on the BlogIngest provided.

Return ONLY JSON in the exact BlogDraft format.

=== BLOG INGEST ===
${JSON.stringify(blogIngest, null, 2)}

=== INSTRUCTIONS ===

1. Length: Aim for ${blogIngest.targetLength || "500-700"} words.

2. Write for a professional BD audience in financial services.

3. Use persona (if provided) to anchor:
   - pain points
   - desired outcomes
   - decision pressures

4. Structure:
   - Title
   - Subtitle
   - Outline (3–6 sections, bullets per section)
   - Body (same sections with 2–3 paragraphs each)

5. Tone:
   - Clear
   - Practical
   - Sharp BD insight
   - Legal framing when relevant

6. Include a CTA relating to BusinessPoint Law at the end.

Output must match the BlogDraft type exactly.
`;

    // Call OpenAI
    const openai = getOpenAIClient();
    const model = 'gpt-4o';

    console.log(`🤖 Calling OpenAI (${model}) for blog generation...`);
    console.log(`Mode: ${blogIngest.mode}`);
    console.log(`Topic: ${blogIngest.topic}`);
    console.log(`Target Length: ${blogIngest.targetLength || '500-700'} words`);

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    let blogDraft: BlogDraft;
    try {
      const parsed = JSON.parse(responseText);
      
      // Ensure BlogDraft structure
      blogDraft = {
        title: parsed.title || `${blogIngest.topic} - Blog Post`,
        subtitle: parsed.subtitle || undefined,
        outline: parsed.outline || {
          sections: [],
        },
        body: parsed.body || {
          sections: [],
        },
        summary: parsed.summary || undefined,
        cta: parsed.cta || undefined,
      };

      // Validate structure
      if (!blogDraft.outline.sections || !Array.isArray(blogDraft.outline.sections)) {
        blogDraft.outline.sections = [];
      }
      if (!blogDraft.body.sections || !Array.isArray(blogDraft.body.sections)) {
        blogDraft.body.sections = [];
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', responseText);
      throw new Error('Invalid JSON response from AI');
    }

    console.log('✅ Blog generated successfully');
    console.log(`Title: ${blogDraft.title}`);
    console.log(`Sections: ${blogDraft.body.sections.length}`);

    return NextResponse.json({
      success: true,
      blogDraft,
    });
  } catch (error: any) {
    console.error('❌ Blog generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate blog',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

