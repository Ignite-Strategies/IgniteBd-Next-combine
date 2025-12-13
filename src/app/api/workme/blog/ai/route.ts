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

    // Validate based on mode
    if (blogIngest.mode === 'persona') {
      if (!blogIngest.persona || !blogIngest.topic || !blogIngest.problem) {
        return NextResponse.json(
          { success: false, error: 'persona, topic, and problem are required for persona mode' },
          { status: 400 },
        );
      }
    } else if (blogIngest.mode === 'idea') {
      if (!blogIngest.idea) {
        return NextResponse.json(
          { success: false, error: 'idea is required for idea mode' },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'mode must be "persona" or "idea"' },
        { status: 400 },
      );
    }

    // Build the AI prompt based on mode
    let prompt: string;
    
    if (blogIngest.mode === 'idea') {
      // IDEA MODE: Generate blog from idea with specific requirements
      prompt = `
You are a Business Development and Legal Content Strategist for BusinessPoint Law.

Your task: 
Generate a structured BlogDraft JSON object based on the core idea provided.

Return ONLY JSON in the exact BlogDraft format.

=== CORE IDEA ===
${blogIngest.idea}

=== REQUIREMENTS ===

1. **Length**: MUST be exactly 500 words. Count carefully and ensure the total word count is 500 words.

2. **Structure**:
   - Start with an introduction section that hooks the reader and sets up the topic
   - Use the ideas put in the box to infer the content, themes, and direction
   - Build out 3-5 main body sections that expand on the idea
   - End with a conclusion and CTA

3. **Content Direction**:
   - Use the core idea to infer:
     - What problem or opportunity this addresses
     - Who the target audience is
     - What key points and insights should be covered
     - What actionable takeaways readers should have

4. **Structure Details**:
   - Title: Compelling, specific to the idea
   - Subtitle: Optional but helpful context
   - Outline: 3-5 sections with clear headings and bullet points
   - Body: Same sections with 2-3 rich paragraphs each (total ~500 words)
   - CTA: Relating to BusinessPoint Law services

5. **Tone**:
   - Clear and professional
   - Practical and actionable
   - Sharp BD insight
   - Legal framing when relevant

Output must match the BlogDraft type exactly.
`;
    } else {
      // PERSONA MODE: Original persona-based generation
      prompt = `
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
    }

    // Call OpenAI
    const openai = getOpenAIClient();
    const model = 'gpt-4o';

    console.log(`🤖 Calling OpenAI (${model}) for blog generation...`);
    console.log(`Mode: ${blogIngest.mode}`);
    if (blogIngest.mode === 'idea') {
      console.log(`Idea: ${blogIngest.idea}`);
      console.log(`Target Length: 500 words (required for idea mode)`);
    } else {
      console.log(`Topic: ${blogIngest.topic}`);
      console.log(`Target Length: ${blogIngest.targetLength || '500-700'} words`);
    }

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
      const defaultTitle = blogIngest.mode === 'idea' 
        ? (blogIngest.idea || 'Blog Post')
        : (`${blogIngest.topic || 'Blog'} - Blog Post`);
      
      blogDraft = {
        title: parsed.title || defaultTitle,
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

