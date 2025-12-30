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
  console.log('🚀🚀🚀 POST /api/personas/generate-minimal - Request received');
  console.log('📍 URL:', request.url);
  console.log('📍 Method:', request.method);
  
  // Log headers (but not the token itself for security)
  const authHeader = request.headers.get('authorization');
  console.log('🔑 Auth header present:', !!authHeader);
  console.log('🔑 Auth header starts with Bearer:', authHeader?.startsWith('Bearer '));
  console.log('🔑 Auth header length:', authHeader?.length || 0);
  
  let firebaseUser;
  try {
    console.log('🔐 Attempting Firebase token verification...');
    firebaseUser = await verifyFirebaseToken(request);
    console.log('✅✅✅ Firebase token verified successfully!');
    console.log('✅ Firebase UID:', firebaseUser.uid);
    console.log('✅ Firebase email:', firebaseUser.email);
  } catch (error: any) {
    console.error('❌❌❌ Firebase authentication FAILED:');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json(
      { success: false, error: 'Unauthorized', details: error.message },
      { status: 401 }
    );
  }

  try {
    console.log('👤 Looking up owner in database...');
    // Get owner from Firebase token (like template route)
    const { prisma } = await import('@/lib/prisma');
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      console.error('❌❌❌ Owner not found for firebaseId:', firebaseUser.uid);
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }
    console.log('✅ Owner found:', { id: owner.id, email: owner.email });

    console.log('📦 Parsing request body...');
    const body = await request.json();
    const { contactId, companyHQId, ownerId, description } = body;
    console.log('📦 Request body received:');
    console.log('  - contactId:', contactId);
    console.log('  - companyHQId:', companyHQId);
    console.log('  - ownerId:', ownerId);
    console.log('  - hasDescription:', !!description);

    if (!contactId) {
      console.error('❌ Missing contactId');
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 }
      );
    }

    if (!companyHQId) {
      console.error('❌ Missing companyHQId');
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 }
      );
    }

    // Validate membership - owner must have access to this companyHQ (like template route)
    console.log('🔒 Validating membership...');
    const { resolveMembership } = await import('@/lib/membership');
    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      console.error('❌❌❌ Access denied to companyHQ:', companyHQId);
      console.error('❌ Owner ID:', owner.id);
      return NextResponse.json(
        { success: false, error: 'Access denied to this company' },
        { status: 403 }
      );
    }
    console.log('✅ Membership validated');

    console.log('📊 Step 1: Preparing data...');
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

    console.log('📝 Step 2: Building prompts...');
    // Step 2: Build prompts
    const { systemPrompt, userPrompt } = PersonaMinimalPromptService.buildPrompts(
      prepResult.data,
      description
    );

    console.log('🤖 Step 3: Calling OpenAI...');
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

