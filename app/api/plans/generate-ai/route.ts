import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/plans/generate-ai
 * Generate plan details from natural language description
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
    const { description } = body;

    if (!description || !description.trim()) {
      return NextResponse.json(
        { success: false, error: 'Description is required' },
        { status: 400 },
      );
    }

    // Call OpenAI to generate plan details
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a billing plan generator. Extract plan details from user descriptions.
Return a JSON object with:
- name: Plan name (e.g., "Gold Tier - Monthly")
- description: Plan description
- amountCents: Amount in cents (integer, e.g., 50000 for $500)
- currency: Currency code (lowercase, e.g., "usd")
- interval: "MONTH", "YEAR", or null for one-time

Examples:
- "monthly $500 plan" → { name: "Premium Monthly", amountCents: 50000, currency: "usd", interval: "MONTH" }
- "annual subscription for $5000" → { name: "Annual Premium", amountCents: 500000, currency: "usd", interval: "YEAR" }
- "one-time payment of $100" → { name: "One-time Payment", amountCents: 10000, currency: "usd", interval: null }`,
        },
        {
          role: 'user',
          content: description,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const planData = JSON.parse(content);

    // Validate and normalize
    const plan = {
      name: planData.name || 'Generated Plan',
      description: planData.description || null,
      amountCents: planData.amountCents || 0,
      currency: (planData.currency || 'usd').toLowerCase(),
      interval: planData.interval || null,
    };

    // Ensure amountCents is valid
    if (!plan.amountCents || plan.amountCents <= 0) {
      plan.amountCents = 0; // Will require user to set manually
    }

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('❌ AI plan generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate plan',
      },
      { status: 500 },
    );
  }
}

