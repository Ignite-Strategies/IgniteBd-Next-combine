import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { calculateBDOSScore } from '@/lib/intelligence/BDOSScoringService';

/**
 * POST /api/bdos/score
 * 
 * Calculate BDOS v2 Intelligence Score
 * 
 * Body:
 * {
 *   "contactId": "contact_123",      // Required
 *   "productId": "product_456",       // Required
 *   "personaId": "persona_789"        // Optional - auto-matched if not provided
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "contactId": "contact_123",
 *   "productId": "product_456",
 *   "personaId": "persona_789",
 *   "scores": {
 *     "personaFit": 85,
 *     "productFit": 90,
 *     "companyReadiness": 75,
 *     "buyingPower": 80,
 *     "seniority": 70,
 *     "urgency": 65,
 *     "totalScore": 78
 *   },
 *   "rationale": "Strong fit across all dimensions..."
 * }
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
    const { contactId, productId, personaId } = body;

    // Validate required fields
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 },
      );
    }

    // Verify contact exists and belongs to user's tenant
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { crmId: true },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Verify product exists and belongs to user's tenant
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { companyHQId: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 },
      );
    }

    // Ensure contact and product belong to same tenant
    if (contact.crmId !== product.companyHQId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Contact and Product must belong to the same tenant',
        },
        { status: 403 },
      );
    }

    // Verify persona if provided
    if (personaId) {
      const persona = await prisma.personas.findUnique({
        where: { id: personaId },
        select: { companyHQId: true },
      });

      if (!persona) {
        return NextResponse.json(
          { success: false, error: 'Persona not found' },
          { status: 404 },
        );
      }

      if (persona.companyHQId !== contact.crmId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Persona must belong to the same tenant',
          },
          { status: 403 },
        );
      }
    }

    // Calculate BDOS score
    const result = await calculateBDOSScore(contactId, productId, personaId || null);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to calculate BDOS score',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      contactId: result.contactId,
      productId: result.productId,
      personaId: result.personaId,
      scores: result.scores,
      rationale: result.rationale,
    });
  } catch (error: any) {
    console.error('❌ BDOS score calculation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate BDOS score',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

