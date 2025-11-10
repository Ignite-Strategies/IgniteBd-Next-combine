import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { generatePersona } from '@/lib/services/PersonaGenerationService';

/**
 * POST /api/personas/generate
 * Generate a persona using LLM based on company and product data
 * 
 * Body:
 * - companyHQId (required) - CompanyHQ ID
 * - productId (optional) - Product ID
 * 
 * Returns:
 * - success: true
 * - persona: { persona_name, ideal_roles, core_goals, pain_points, value_prop, impact_statement }
 */
export async function POST(request) {
  try {
    // Verify Firebase token (write operation)
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { companyHQId, productId } = body;

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Verify companyHQ exists
    const companyHQ = await prisma.companyHQ.findUnique({
      where: { id: companyHQId },
      select: { id: true },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    // Verify product exists if provided
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, companyHQId: true },
      });

      if (!product) {
        return NextResponse.json(
          { success: false, error: 'Product not found' },
          { status: 404 },
        );
      }

      if (product.companyHQId !== companyHQId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Product does not belong to this company',
          },
          { status: 403 },
        );
      }
    }

    // Generate persona
    const result = await generatePersona(companyHQId, productId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to generate persona',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      persona: result.persona,
    });
  } catch (error) {
    console.error('❌ Persona generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate persona',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

