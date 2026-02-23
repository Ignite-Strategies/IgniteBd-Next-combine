import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';
import { resolveMembership } from '@/lib/membership';

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

/**
 * POST /api/template/generate-with-snippets
 * Generate a template using AI to intelligently select and order content snippets
 * Body: { companyHQId, intent, ownerId? }
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { companyHQId, intent, ownerId } = body ?? {};

    if (!companyHQId || !intent || intent.trim() === '') {
      return NextResponse.json(
        { error: 'companyHQId and intent are required' },
        { status: 400 },
      );
    }

    // Verify membership
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 });
    }

    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load available content snippets
    const snippets = await prisma.content_snips.findMany({
      where: {
        companyHQId,
        isActive: true,
      },
      select: {
        snipName: true,
        snipText: true,
        snipType: true,
        assemblyHelperPersonas: true,
      },
      orderBy: [{ snipType: 'asc' }, { snipName: 'asc' }],
    });

    if (snippets.length === 0) {
      return NextResponse.json(
        { error: 'No active content snippets found. Please create some snippets first.' },
        { status: 400 },
      );
    }

    // Get owner name for signature
    let ownerName = '[Your name]';
    if (ownerId) {
      try {
        const ownerData = await prisma.owners.findUnique({
          where: { id: ownerId },
          select: { firstName: true, lastName: true, name: true },
        });
        if (ownerData) {
          ownerName = ownerData.firstName || ownerData.name?.split(' ')[0] || '[Your name]';
        }
      } catch (err) {
        console.warn('Could not fetch owner name:', err);
      }
    }

    // Format snippets for AI
    const snippetsList = snippets.map((s) => ({
      name: s.snipName,
      text: s.snipText,
      type: s.snipType,
      assemblyHelperPersonas: s.assemblyHelperPersonas || [],
    }));

    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const systemPrompt = `You are an expert at building email templates by intelligently selecting and ordering content snippets.

Your task is to analyze the user's intent and select the most relevant content snippets, then arrange them in a natural, flowing order to create a complete email template.

CRITICAL RULES:
1. You MUST use the provided snippets - do not invent new content
2. Use snippets in the format: {{snippet:snippetName}}
3. You can combine multiple snippets with your own connecting text
4. Add variables like {{firstName}}, {{companyName}} where appropriate
5. Create a natural flow: greeting → context → value → ask → close
6. Select snippets that match the user's intent and relationship type

SNIPPET SELECTION STRATEGY:
- Start with an "intent" snippet that matches why they're reaching out
- Add "value" or "service" snippets if relevant to the ask
- Use "cta" snippets for the call-to-action
- Consider "relationship" snippets for context
- Order them logically: intent → context → value → ask → close`;

    const userPrompt = `=== USER'S INTENT ===
${intent.trim()}

=== AVAILABLE SNIPPETS ===
${JSON.stringify(snippetsList, null, 2)}

=== YOUR TASK ===
1. Analyze the user's intent and select the most relevant snippets (typically 2-4 snippets)
2. Determine the best order for these snippets
3. Create a complete email template that:
   - Uses selected snippets in format {{snippet:snippetName}}
   - Adds connecting text between snippets for natural flow
   - Includes variables like {{firstName}}, {{companyName}} where appropriate
   - Has a warm, human tone
   - Ends with signature: "${ownerName}"

Return ONLY valid JSON in this exact format:
{
  "title": "Descriptive title for this template",
  "subject": "Email subject line (simple, no variables)",
  "body": "Complete email body using {{snippet:snippetName}} format and variables",
  "selectedSnippets": ["snippetName1", "snippetName2", ...],
  "reasoning": "Brief explanation of why these snippets were selected and ordered this way"
}`;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'AI generation failed: Empty response' },
        { status: 500 },
      );
    }

    let generated;
    try {
      generated = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json(
        { error: 'AI generation failed: Invalid response format' },
        { status: 500 },
      );
    }

    // Validate response
    if (!generated.title || !generated.subject || !generated.body) {
      return NextResponse.json(
        { error: 'AI generation failed: Missing required fields' },
        { status: 500 },
      );
    }

    // Verify selected snippets exist
    const selectedSnippets = generated.selectedSnippets || [];
    const validSnippets = snippets.map((s) => s.snipName);
    const invalidSnippets = selectedSnippets.filter((name) => !validSnippets.includes(name));
    if (invalidSnippets.length > 0) {
      console.warn('AI selected invalid snippets:', invalidSnippets);
    }

    return NextResponse.json({
      success: true,
      template: {
        title: generated.title,
        subject: generated.subject,
        body: generated.body,
      },
      selectedSnippets: selectedSnippets.filter((name) => validSnippets.includes(name)),
      reasoning: generated.reasoning || 'Snippets selected based on intent matching',
      availableSnippets: snippets.length,
    });
  } catch (error) {
    console.error('❌ AI template generation error:', error);
    if (error.message?.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'AI service error: Invalid OpenAI API key configuration' },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: `AI generation failed: ${error.message || 'Unknown error'}` },
      { status: 500 },
    );
  }
}
