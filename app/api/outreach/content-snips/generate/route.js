import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';
import { prisma } from '@/lib/prisma';

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

const TEMPLATE_POSITIONS = ['SUBJECT_LINE', 'OPENING_GREETING', 'CATCH_UP', 'BUSINESS_CONTEXT', 'VALUE_PROPOSITION', 'COMPETITOR_FRAME', 'TARGET_ASK', 'SOFT_CLOSE'];
const LEGACY_SNIP_TYPE_TO_POSITION = {
  subject: 'SUBJECT_LINE', intent: 'OPENING_GREETING', service: 'BUSINESS_CONTEXT', competitor: 'COMPETITOR_FRAME',
  value: 'VALUE_PROPOSITION', cta: 'TARGET_ASK', relationship: 'SOFT_CLOSE', generic: 'SOFT_CLOSE',
};

function normalizeSnipName(s) {
  return String(s).trim().replace(/\s+/g, '_').toLowerCase() || null;
}

/**
 * POST /api/outreach/content-snips/generate
 * Generate a content snip using AI
 * Body: { companyHQId, prompt }
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { companyHQId, prompt } = body;

  if (!companyHQId || !prompt?.trim()) {
    return NextResponse.json(
      { success: false, error: 'companyHQId and prompt are required' },
      { status: 400 },
    );
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const systemPrompt = `You are a helpful assistant that creates concise, natural-sounding content snippets for business outreach and templates.

Content snippets are reusable text blocks that can contain variable placeholders like {{firstName}}, {{companyName}}, etc.

Generate a content snippet based on the user's prompt. Return a JSON object with:
- snipName: a short, snake_case name (e.g., "intent_reach_out", "cta_book_call")
- snipText: the actual content text (can include variables like {{firstName}})
- templatePosition: one of: ${TEMPLATE_POSITIONS.join(', ')} (where in the email: SUBJECT_LINE, OPENING_GREETING, CATCH_UP, BUSINESS_CONTEXT, VALUE_PROPOSITION, COMPETITOR_FRAME, TARGET_ASK, SOFT_CLOSE)

Keep snipText concise (1-3 sentences typically). Make it natural and professional.`;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Create a content snippet based on this request: ${prompt.trim()}`,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'AI generation failed: Empty response' },
        { status: 500 },
      );
    }

    let generated;
    try {
      generated = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json(
        { success: false, error: 'AI generation failed: Invalid response format' },
        { status: 500 },
      );
    }

    const snipName = normalizeSnipName(generated.snipName || prompt.split(' ').slice(0, 3).join('_'));
    const snipText = String(generated.snipText || '').trim();
    const templatePosition = TEMPLATE_POSITIONS.includes(generated.templatePosition)
      ? generated.templatePosition
      : (LEGACY_SNIP_TYPE_TO_POSITION[generated.snipType] || 'SOFT_CLOSE');

    if (!snipText) {
      return NextResponse.json(
        { success: false, error: 'AI generation failed: No text generated' },
        { status: 500 },
      );
    }

    const snipSlug = snipName; // UI can override; must be unique when saving

    return NextResponse.json({
      success: true,
      snip: {
        snipName,
        snipSlug,
        snipText,
        templatePosition,
      },
    });
  } catch (error) {
    console.error('❌ Content snip AI generation error:', error);
    if (error.message?.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { success: false, error: 'AI service error: Invalid OpenAI API key configuration' },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { success: false, error: `AI generation failed: ${error.message || 'Unknown error'}` },
      { status: 500 },
    );
  }
}
