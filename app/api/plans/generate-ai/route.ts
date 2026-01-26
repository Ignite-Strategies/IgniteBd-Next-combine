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

    // Build prompt with explicit JSON structure
    const prompt = `You are a billing plan generator. Extract plan details from user descriptions.

=== YOUR TASK ===
Analyze the user's description and extract:
1. Plan name (e.g., "Starter Advisory and Onboarding", "Premium Monthly", "Annual Enterprise")
2. Description (optional, brief description of what the plan includes)
3. Amount in cents (convert dollars to cents, e.g., $500 = 50000)
4. Currency (default to "usd")
5. Billing interval ("MONTH", "YEAR", or null for one-time payments)

=== EXAMPLES ===

Input: "monthly $500 plan with premium features"
Output:
{
  "name": "Premium Monthly",
  "description": "Monthly subscription with premium features",
  "amountCents": 50000,
  "currency": "usd",
  "interval": "MONTH"
}

Input: "one-time payment of $1500 for starter advisory"
Output:
{
  "name": "Starter Advisory and Onboarding",
  "description": "One-time payment for starter advisory services and onboarding",
  "amountCents": 150000,
  "currency": "usd",
  "interval": null
}

Input: "annual subscription for $5000"
Output:
{
  "name": "Annual Premium",
  "description": "Annual subscription plan",
  "amountCents": 500000,
  "currency": "usd",
  "interval": "YEAR"
}

=== RULES ===
- If user says "one-time" or "single payment", set interval to null
- If user says "monthly" or "per month", set interval to "MONTH"
- If user says "annual" or "yearly", set interval to "YEAR"
- Always convert dollar amounts to cents (multiply by 100)
- Default currency to "usd" if not specified
- Generate a descriptive plan name based on the description

CRITICAL: Return ONLY valid JSON. Do not include markdown code blocks, explanations, or any text outside the JSON object.`;

    // Call OpenAI
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates billing plan details. Return only valid JSON.',
        },
        {
          role: 'user',
          content: `${prompt}\n\nUser description: ${description}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from AI');
    }

    // Parse JSON response
    let planData;
    try {
      planData = JSON.parse(responseText);
    } catch (e) {
      // Try to extract JSON from markdown if AI wrapped it
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        planData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

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

    // Normalize interval
    if (plan.interval && typeof plan.interval === 'string') {
      plan.interval = plan.interval.toUpperCase();
      if (plan.interval !== 'MONTH' && plan.interval !== 'YEAR') {
        plan.interval = null;
      }
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

