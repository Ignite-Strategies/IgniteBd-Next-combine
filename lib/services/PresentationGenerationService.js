import { OpenAI } from 'openai';
import { prisma } from '../prisma';

// Lazy initialization of OpenAI client
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

/**
 * Presentation Generation Service
 * 
 * Generates presentation outline with slides using OpenAI
 * 
 * @param {string} presentationIdea - The idea/description for the presentation
 * @param {number} slideCount - Number of slides to generate
 * @param {string} presenter - Optional: Name of the presenter
 * @param {string} presenterExpertise - Optional: Expertise/background of the presenter (e.g., "10 years in SaaS sales", "Legal expert", "Marketing director")
 * @returns {Promise<Object>} Generated presentation outline with slides
 */
export async function generatePresentationOutline(
  presentationIdea, 
  slideCount = 10,
  presenter = null,
  presenterExpertise = null
) {
  try {
    console.log(`🎯 Generating presentation outline: ${slideCount} slides${presenter ? ` for ${presenter}` : ''}`);

    // Build presenter context for AI
    let presenterContext = '';
    if (presenter || presenterExpertise) {
      presenterContext = '\n\nPRESENTER CONTEXT:\n';
      if (presenter) {
        presenterContext += `- Presenter: ${presenter}\n`;
      }
      if (presenterExpertise) {
        presenterContext += `- Expertise/Background: ${presenterExpertise}\n`;
      }
      presenterContext += '\nTailor the content, language, examples, and depth to match this presenter\'s expertise and background. Use terminology and examples that align with their experience level.';
    }

    // Build the user prompt
    const userPrompt = `Create a presentation outline with EXACTLY ${slideCount} slides based on this idea:

${presentationIdea}${presenterContext}

CRITICAL: You must return EXACTLY ${slideCount} slides in the slides array. No more, no less.

Generate a structured presentation outline. Return ONLY a valid JSON object with these exact keys:
{
  "title": "string (compelling presentation title)",
  "description": "string (brief description of the presentation)",
  "slides": [
    {
      "slideNumber": 1,
      "title": "string (slide title)",
      "content": "string (key points or talking points for this slide - 2-3 bullet points or short paragraph)",
      "notes": "string (optional presenter notes or context)"
    }
  ]
}

Each slide should have:
- A clear, compelling title
- Content that includes key points, bullet points, or talking points
- Optional presenter notes if helpful

Structure the slides logically:
- Start with an introduction/title slide
- Include agenda/overview if appropriate
- Build through main content slides (distribute content across all ${slideCount} slides)
- End with conclusion/next steps/call to action

IMPORTANT: The slides array MUST contain exactly ${slideCount} items. Count them before returning.

Be specific to the presentation idea provided and make it practical and actionable.`;

    // System prompt
    const systemPrompt = `You are an expert presentation designer. Your job is to create structured, compelling presentation outlines that help presenters deliver clear and engaging content.

CRITICAL REQUIREMENTS:
1. You MUST create EXACTLY the requested number of slides - count them in the slides array before returning
2. Make each slide focused and actionable
3. Use clear, compelling titles
4. Provide useful talking points in the content field
5. Structure logically with introduction, main content, and conclusion
6. Be specific to the presentation topic/idea
7. Distribute content evenly across all slides - don't cram everything into a few slides
8. ${presenter || presenterExpertise ? 'IMPORTANT: Tailor the content, complexity, examples, and terminology to match the presenter\'s expertise and background. Adjust the depth and sophistication of the material based on their experience level.' : ''}

${presenter || presenterExpertise ? `PRESENTER ADAPTATION:\n- Adjust language complexity and technical depth to match their expertise\n- Use examples and case studies relevant to their background\n- Include presenter notes that leverage their specific knowledge and experience\n- Ensure the content is authentic to their voice and expertise level\n` : ''}

Return ONLY valid JSON. No markdown, no code blocks, just the JSON object. The slides array must have exactly the number of slides requested.`;

    // Call OpenAI
    console.log('🤖 Calling OpenAI for presentation outline generation...');
    
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    const completion = await openai.chat.completions.create({
      model: model,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      response_format: { type: 'json_object' }, // Ensure JSON response
      max_tokens: 8000, // Increased for larger presentations (up to 100 slides)
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No GPT output received.');
    }

    // Parse JSON response
    let presentationData;
    try {
      presentationData = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        presentationData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate response structure
    if (!presentationData.title || !Array.isArray(presentationData.slides)) {
      throw new Error('Invalid presentation structure from OpenAI');
    }

    // Ensure we have the right number of slides - pad or truncate if needed
    if (presentationData.slides.length !== slideCount) {
      console.warn(`⚠️ Requested ${slideCount} slides, got ${presentationData.slides.length}. Adjusting...`);
      
      if (presentationData.slides.length < slideCount) {
        // Add empty slides to reach the count
        const missing = slideCount - presentationData.slides.length;
        for (let i = 0; i < missing; i++) {
          presentationData.slides.push({
            slideNumber: presentationData.slides.length + 1,
            title: `Slide ${presentationData.slides.length + 1}`,
            content: '',
            notes: null,
          });
        }
      } else if (presentationData.slides.length > slideCount) {
        // Truncate to the requested count
        presentationData.slides = presentationData.slides.slice(0, slideCount);
      }
    }

    // Ensure slides have required fields and correct numbering
    presentationData.slides = presentationData.slides.map((slide, index) => ({
      slideNumber: index + 1,
      title: slide.title || `Slide ${index + 1}`,
      content: slide.content || '',
      notes: slide.notes || null,
    }));
    
    // Ensure we have exactly the right count after processing
    if (presentationData.slides.length !== slideCount) {
      throw new Error(`Failed to generate exactly ${slideCount} slides. Got ${presentationData.slides.length} instead.`);
    }

    console.log(`✅ Presentation outline generated: "${presentationData.title}" with ${presentationData.slides.length} slides`);

    return {
      success: true,
      presentation: presentationData,
      rawResponse: content,
    };
  } catch (error) {
    console.error('❌ Presentation Generation failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
