/**
 * POST /api/personas/generate-minimal
 * 
 * MVP1: Generate minimal persona (who they are, what company, core goal)
 * 
 * REQUEST CONTRACT:
 * {
 *   contactId: string (REQUIRED) - Contact ID to generate persona from
 *   companyHQId: string (REQUIRED) - Company HQ context
 *   description?: string (OPTIONAL) - Optional description override
 * }
 * 
 * NOTE: ownerId is NOT accepted in request body. Owner is derived from Firebase token.
 * 
 * RESPONSE CONTRACT:
 * Success (200):
 * {
 *   success: true,
 *   persona: {
 *     personName: string,
 *     title: string,
 *     company: string,
 *     coreGoal: string
 *   }
 * }
 * 
 * Error (400/401/403/404/500):
 * {
 *   success: false,
 *   error: string (human-readable message)
 * }
 * 
 * Flow:
 * 1. Verify Firebase token → get owner
 * 2. Validate request body (contactId, companyHQId required)
 * 3. Validate membership (owner must have access to companyHQ)
 * 4. Fetch contact and companyHQ from DB
 * 5. Build AI prompts
 * 6. Call OpenAI
 * 7. Parse and return persona
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { PersonaPromptPrepService } from '@/lib/services/PersonaPromptPrepService';
import { PersonaMinimalPromptService } from '@/lib/services/PersonaMinimalPromptService';
import { PersonaParsingService } from '@/lib/services/PersonaParsingService';
import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  // ============================================
  // STEP 1: AUTHENTICATION
  // ============================================
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unauthorized: Invalid or missing authentication token' 
      },
      { status: 401 }
    );
  }

  // ============================================
  // STEP 2: GET OWNER FROM FIREBASE TOKEN
  // ============================================
  let owner;
  try {
    owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true, email: true },
    });

    if (!owner) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Owner not found: No account associated with this authentication token' 
        },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error('❌ Database error while fetching owner:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database error: Failed to verify owner account' 
      },
      { status: 500 }
    );
  }

  // ============================================
  // STEP 3: PARSE AND VALIDATE REQUEST BODY
  // ============================================
  let body;
  try {
    body = await request.json();
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid request: Request body must be valid JSON' 
      },
      { status: 400 }
    );
  }

  // Extract fields (explicitly ignore ownerId if sent - owner comes from auth)
  const { contactId, companyHQId, description, ownerId: _ignoredOwnerId } = body;

  // Validate required fields
  if (!contactId || typeof contactId !== 'string' || contactId.trim() === '') {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Validation error: contactId is required and must be a non-empty string' 
      },
      { status: 400 }
    );
  }

  if (!companyHQId || typeof companyHQId !== 'string' || companyHQId.trim() === '') {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Validation error: companyHQId is required and must be a non-empty string' 
      },
      { status: 400 }
    );
  }

  // Validate optional description if provided
  if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Validation error: description must be a non-empty string if provided' 
      },
      { status: 400 }
    );
  }

  // ============================================
  // STEP 4: VALIDATE MEMBERSHIP
  // ============================================
  try {
    const { resolveMembership } = await import('@/lib/membership');
    const { membership } = await resolveMembership(owner.id, companyHQId);
    
    if (!membership) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden: You do not have access to this company. Verify companyHQId is correct.' 
        },
        { status: 403 }
      );
    }
  } catch (error: any) {
    console.error('❌ Membership validation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Authorization error: Failed to verify company access' 
      },
      { status: 500 }
    );
  }

  // ============================================
  // STEP 5: PREPARE DATA (FETCH CONTACT & COMPANYHQ)
  // ============================================
  let prepResult;
  try {
    prepResult = await PersonaPromptPrepService.prepare({
      contactId: contactId.trim(),
      companyHQId: companyHQId.trim(),
    });
  } catch (error: any) {
    console.error('❌ PersonaPromptPrepService error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Data preparation failed: ${error.message || 'Failed to fetch contact or company data'}` 
      },
      { status: 400 }
    );
  }

  if (!prepResult.success || !prepResult.data) {
    return NextResponse.json(
      {
        success: false,
        error: prepResult.error || 'Data preparation failed: Unable to fetch required data',
      },
      { status: 400 }
    );
  }

  // ============================================
  // STEP 6: BUILD AI PROMPTS
  // ============================================
  let systemPrompt: string;
  let userPrompt: string;
  try {
    const prompts = PersonaMinimalPromptService.buildPrompts(
      prepResult.data,
      description?.trim() || undefined
    );
    systemPrompt = prompts.systemPrompt;
    userPrompt = prompts.userPrompt;
  } catch (error: any) {
    console.error('❌ Prompt building error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Prompt generation failed: ${error.message || 'Failed to build AI prompts'}` 
      },
      { status: 500 }
    );
  }

  // ============================================
  // STEP 7: CALL OPENAI
  // ============================================
  let content: string;
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    content = completion.choices?.[0]?.message?.content || '';
    
    if (!content) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'AI generation failed: OpenAI returned an empty response' 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('❌ OpenAI API error:', error);
    
    // Provide specific error messages for common OpenAI errors
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'AI service error: Invalid OpenAI API key configuration' 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: `AI generation failed: ${error.message || 'OpenAI API request failed'}` 
      },
      { status: 500 }
    );
  }

  // ============================================
  // STEP 8: PARSE AI RESPONSE
  // ============================================
  let persona;
  try {
    persona = PersonaParsingService.parse(content);
  } catch (error: any) {
    console.error('❌ Persona parsing error:', error);
    console.error('❌ Raw OpenAI response:', content);
    return NextResponse.json(
      { 
        success: false, 
        error: `Response parsing failed: ${error.message || 'AI response was not in the expected format'}` 
      },
      { status: 500 }
    );
  }

  // ============================================
  // STEP 9: RETURN SUCCESS
  // ============================================
  return NextResponse.json({
    success: true,
    persona,
  });
}
