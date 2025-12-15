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

Return ONLY valid JSON in the exact BlogDraft format - no markdown, no code blocks, just pure JSON.

=== CORE IDEA ===
${blogIngest.idea}

=== REQUIREMENTS ===

1. **Length**: MUST be exactly 500 words in the body content only. Count carefully.

2. **JSON Structure - CRITICAL**:
You MUST return JSON matching this exact structure:
{
  "title": "Compelling blog title (ONLY the title, max 100 characters)",
  "subtitle": "Optional subtitle providing context (max 150 characters)",
  "outline": {
    "sections": [
      {
        "heading": "Section heading",
        "bullets": ["bullet point 1", "bullet point 2"]
      }
    ]
  },
  "body": {
    "sections": [
      {
        "heading": "Section heading",
        "content": "2-3 rich paragraphs of content for this section"
      }
    ]
  },
  "summary": "Optional brief summary",
  "cta": "Call to action text"
}

3. **Title Rules**:
   - Title MUST be a short, compelling headline (max 100 characters)
   - Title MUST NOT contain body content, narrative, or section text
   - Title should be specific to the idea

4. **Subtitle Rules**:
   - Subtitle is OPTIONAL but recommended
   - Provides additional context or hook (max 150 characters)
   - Should complement the title

5. **Body Structure**:
   - Start with an introduction section that hooks the reader
   - Build out 3-5 main body sections that expand on the idea
   - End with a conclusion section
   - Each section should have a clear heading and 2-3 rich paragraphs
   - Total body content must be exactly 500 words

6. **Content Inference Process - CRITICAL**:
   Read the core idea and infer the following:
   
   a) **Problem/Opportunity**: What specific problem does this idea address? What opportunity does it highlight?
      - Example: If idea is "NDA negotiation strategies", problem might be "NDAs create friction in deal processes"
   
   b) **Target Audience**: Who would benefit from this content? What role/seniority/industry?
      - Example: Private credit sponsors, deal lawyers, BD professionals
   
   c) **Key Points & Insights**: What are the main takeaways from this idea?
      - What practical insights can you extract?
      - What common mistakes or pitfalls should be addressed?
      - What best practices emerge from this idea?
   
   d) **Solution/Actionable Content**: What solutions, frameworks, or actionable advice can be provided?
      - What steps can readers take?
      - What frameworks or methodologies apply?
      - What real-world examples illustrate the point?
   
   e) **Business Development Angle**: How does this connect to BD strategy and client acquisition?
      - Why does this matter for BD professionals?
      - How can this help win business or serve clients better?
   
   Use these inferences to structure your blog content. The introduction should hook with the problem, body sections should explore insights and solutions, and conclusion should provide actionable takeaways.

7. **Tone**:
   - Clear and professional
   - Practical and actionable
   - Sharp BD insight
   - Legal framing when relevant

CRITICAL: Return ONLY valid JSON. Do not include markdown code blocks, explanations, or any text outside the JSON object.
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

4. JSON Structure - CRITICAL:
You MUST return JSON matching this exact structure:
{
  "title": "Compelling blog title (ONLY the title, max 100 characters)",
  "subtitle": "Optional subtitle providing context (max 150 characters)",
  "outline": {
    "sections": [
      {
        "heading": "Section heading",
        "bullets": ["bullet point 1", "bullet point 2"]
      }
    ]
  },
  "body": {
    "sections": [
      {
        "heading": "Section heading",
        "content": "2-3 rich paragraphs of content for this section"
      }
    ]
  },
  "summary": "Optional brief summary",
  "cta": "Call to action text"
}

5. Title Rules:
   - Title MUST be a short, compelling headline (max 100 characters)
   - Title MUST NOT contain body content, narrative, or section text

6. Subtitle Rules:
   - Subtitle is OPTIONAL but recommended
   - Provides additional context (max 150 characters)

7. Body Structure:
   - Outline: 3-6 sections with clear headings and bullet points
   - Body: Same sections with 2-3 rich paragraphs each (total word count should match target length)

8. Tone:
   - Clear and professional
   - Practical and actionable
   - Sharp BD insight
   - Legal framing when relevant

9. Include a CTA relating to BusinessPoint Law at the end.

CRITICAL: Return ONLY valid JSON. Do not include markdown code blocks, explanations, or any text outside the JSON object.
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
      // Clean response text - remove markdown code blocks if present
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      cleanedText = cleanedText.trim();
      
      const parsed = JSON.parse(cleanedText);
      
      // Ensure BlogDraft structure with validation
      const defaultTitle = blogIngest.mode === 'idea' 
        ? (blogIngest.idea?.substring(0, 100) || 'Blog Post')
        : (`${blogIngest.topic || 'Blog'} - Blog Post`);
      
      // Clean title - ensure it's just the title, not mixed with body content
      let cleanTitle = (parsed.title || defaultTitle).trim();
      // Remove common issues: remove any content after newlines or colons that look like body content
      if (cleanTitle.includes('\n')) {
        cleanTitle = cleanTitle.split('\n')[0].trim();
      }
      // Limit title length
      if (cleanTitle.length > 100) {
        cleanTitle = cleanTitle.substring(0, 97) + '...';
      }
      
      // Clean subtitle
      let cleanSubtitle = parsed.subtitle?.trim();
      if (cleanSubtitle && cleanSubtitle.length > 150) {
        cleanSubtitle = cleanSubtitle.substring(0, 147) + '...';
      }
      
      blogDraft = {
        title: cleanTitle,
        subtitle: cleanSubtitle || undefined,
        outline: parsed.outline || {
          sections: [],
        },
        body: parsed.body || {
          sections: [],
        },
        summary: parsed.summary || undefined,
        cta: parsed.cta || undefined,
      };

      // Validate and clean structure
      if (!blogDraft.outline.sections || !Array.isArray(blogDraft.outline.sections)) {
        blogDraft.outline.sections = [];
      }
      if (!blogDraft.body.sections || !Array.isArray(blogDraft.body.sections)) {
        blogDraft.body.sections = [];
      }
      
      // Validate that body sections have proper structure
      blogDraft.body.sections = blogDraft.body.sections.map((section: any) => ({
        heading: section.heading || '',
        content: section.content || '',
      }));
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

