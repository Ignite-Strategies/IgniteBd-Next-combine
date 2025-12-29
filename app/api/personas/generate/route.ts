/**
 * POST /api/personas/generate
 * 
 * Generate persona JSON (hydrate mode - doesn't save to DB)
 * Returns JSON that user can edit before saving
 */

import { NextRequest, NextResponse } from 'next/server';
import { PersonaGeneratorService } from '@/lib/services/PersonaGeneratorService';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

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
    const {
      contactId,
      redisKey,
      description,
      companyHQId,
      productId,
      productDescription,
      notes,
    } = body;

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 }
      );
    }

    // Validate product context
    if (!productId && !productDescription) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product context required. Provide productId or productDescription.',
        },
        { status: 400 }
      );
    }

    // Generate persona
    const result = await PersonaGeneratorService.generate({
      contactId,
      redisKey,
      description,
      companyHQId,
      productId,
      productDescription,
      notes,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to generate persona',
          details: result.details,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      persona: result.persona,
    });
  } catch (error: any) {
    console.error('❌ Persona generate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate persona',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
