/**
 * POST /api/personas/generate-minimal
 * 
 * MVP1: Generate minimal persona (who they are, what company, core goal)
 * 
 * Flow:
 * 1. Fetch contact and companyHQ from DB
 * 2. Prepare data for prompt
 * 3. Build AI prompts
 * 4. Call OpenAI
 * 5. Parse response
 * 6. Return persona
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { PersonaPromptPrepService } from '@/lib/services/PersonaPromptPrepService';
import { PersonaMinimalPromptService } from '@/lib/services/PersonaMinimalPromptService';
import { PersonaParsingService } from '@/lib/services/PersonaParsingService';
import { OpenAI } from 'openai';

export async function POST(request: NextRequest) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { contactId, companyHQId, description } = body;

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 }
      );
    }

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 }
      );
    }

    // Step 1: Prepare data (fetch contact and companyHQ from DB)
    const prepResult = await PersonaPromptPrepService.prepare({
      contactId,
      companyHQId,
    });

    if (!prepResult.success || !prepResult.data) {
      return NextResponse.json(
        {
          success: false,
          error: prepResult.error || 'Failed to prepare persona data',
        },
        { status: 400 }
      );
    }

    // Step 2: Build prompts
    const { systemPrompt, userPrompt } = PersonaMinimalPromptService.buildPrompts(
      prepResult.data,
      description
    );

    // Step 3: Call OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    console.log(`🤖 Generating minimal persona (${model})...`);

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
      return NextResponse.json(
        { success: false, error: 'No response from OpenAI' },
        { status: 500 }
      );
    }

    // Step 4: Parse response
    const persona = PersonaParsingService.parse(content);

    return NextResponse.json({
      success: true,
      persona,
    });
  } catch (error: any) {
    console.error('❌ Persona generate-minimal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate minimal persona',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

