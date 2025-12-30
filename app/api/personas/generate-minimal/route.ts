/**
 * POST /api/personas/generate-minimal
 * 
 * MVP1: Generate minimal persona (who they are, what company, core goal)
 * No product complexity - just the essentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { PersonaMinimalService } from '@/lib/services/PersonaMinimalService';
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
    const { contactId, companyHQId, description } = body;

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 }
      );
    }

    // Generate minimal persona
    const result = await PersonaMinimalService.generate({
      contactId,
      companyHQId,
      description,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to generate minimal persona',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      persona: result.persona,
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

