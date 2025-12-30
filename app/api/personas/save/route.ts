/**
 * POST /api/personas/save
 * 
 * Save persona to database
 * Accepts persona JSON (from generate endpoint or user edits)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { PersonaJSON } from '@/lib/services/PersonaGeneratorService';

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
    const { persona, personaId, companyHQId } = body as { persona: PersonaJSON; personaId?: string; companyHQId: string };

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 }
      );
    }

    if (!persona) {
      return NextResponse.json(
        { success: false, error: 'Persona data required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!persona.personName || !persona.title || !persona.coreGoal || !persona.needForOurProduct) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: personName, title, coreGoal, needForOurProduct',
        },
        { status: 400 }
      );
    }

    // Save or update persona
    const savedPersona = personaId
      ? await prisma.personas.update({
          where: { id: personaId },
          data: {
            personName: persona.personName,
            title: persona.title,
            seniority: persona.seniority || null,
            industry: persona.industry || null,
            companySize: persona.companySize || null,
            company: persona.company || null,
            painPoints: persona.painPoints || [],
            coreGoal: persona.coreGoal || null,
            needForOurProduct: persona.needForOurProduct || null,
            updatedAt: new Date(),
          },
        })
      : await prisma.personas.create({
          data: {
            companyHQId,
            personName: persona.personName,
            title: persona.title,
            seniority: persona.seniority || null,
            industry: persona.industry || null,
            companySize: persona.companySize || null,
            company: persona.company || null,
            painPoints: persona.painPoints || [],
            coreGoal: persona.coreGoal || null,
            needForOurProduct: persona.needForOurProduct || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

    return NextResponse.json({
      success: true,
      persona: savedPersona,
    });
  } catch (error: any) {
    console.error('❌ Persona save error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save persona',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

