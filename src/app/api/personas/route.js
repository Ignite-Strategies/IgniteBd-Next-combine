import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAlignmentScore } from '@/lib/alignmentScore';
import { verifyFirebaseToken, optionallyVerifyFirebaseToken } from '@/lib/firebaseAdmin';

const DEFAULT_COMPANY_HQ_ID = process.env.DEFAULT_COMPANY_HQ_ID || null;

export async function GET(request) {
  // Use optionalAuth for GET requests (read operations)
  // Data is scoped by companyHQId, so auth is optional
  await optionallyVerifyFirebaseToken(request);

  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId') || DEFAULT_COMPANY_HQ_ID;
    const productId = searchParams.get('productId');

    if (!companyHQId) {
      return NextResponse.json(
        { error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const personas = await prisma.persona.findMany({
      where: {
        companyHQId,
        ...(productId ? { 
          productFit: {
            productId: productId
          }
        } : {}),
      },
      include: {
        productFit: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                valueProp: true,
              },
            },
          },
        },
        bdIntel: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(personas);
  } catch (error) {
    console.error('❌ Personas GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personas' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      id = null,
      name,
      role = null,
      title = null,
      headline = null,
      seniority = null,
      industry = null,
      subIndustries = null,
      company = null,
      companySize = null,
      annualRevenue = null,
      location = null,
      description = null,
      whatTheyWant = null, // New field (replaces goals)
      goals = null, // Deprecated - map to whatTheyWant if provided
      painPoints = null, // Can be string (old) or JSON array (new)
      risks = null,
      decisionDrivers = null,
      workflows = null,
      desiredOutcome = null, // Deprecated
      valuePropToPersona = null, // Deprecated
      productId = null,
      alignmentScore: alignmentScoreInput,
      companyHQId,
    } = body ?? {};

    const tenantId = companyHQId || DEFAULT_COMPANY_HQ_ID;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 },
      );
    }

    // Normalize painPoints - convert string to array if needed
    let normalizedPainPoints = painPoints;
    if (painPoints && typeof painPoints === 'string') {
      // Try to parse as JSON, otherwise wrap in array
      try {
        normalizedPainPoints = JSON.parse(painPoints);
      } catch {
        // If it's a plain string, convert to array
        normalizedPainPoints = [painPoints];
      }
    }

    // Map deprecated fields to new fields
    const finalWhatTheyWant = whatTheyWant || goals || null;
    
    const personaData = {
      companyHQId: tenantId,
      name,
      role,
      title,
      headline,
      seniority,
      industry,
      subIndustries: subIndustries ? (typeof subIndustries === 'string' ? JSON.parse(subIndustries) : subIndustries) : null,
      company,
      companySize,
      annualRevenue,
      location,
      description,
      whatTheyWant: finalWhatTheyWant,
      painPoints: normalizedPainPoints,
      risks: risks ? (typeof risks === 'string' ? JSON.parse(risks) : risks) : null,
      decisionDrivers: decisionDrivers ? (typeof decisionDrivers === 'string' ? JSON.parse(decisionDrivers) : decisionDrivers) : null,
      workflows: workflows ? (typeof workflows === 'string' ? JSON.parse(workflows) : workflows) : null,
    };

    let persona;
    if (id) {
      const existing = await prisma.persona.findUnique({
        where: { id },
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Persona not found' },
          { status: 404 },
        );
      }

      persona = await prisma.persona.update({
        where: { id },
        data: personaData,
        include: {
          productFit: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  valueProp: true,
                },
              },
            },
          },
          bdIntel: true,
        },
      });
    } else {
      persona = await prisma.persona.create({
        data: personaData,
        include: {
          productFit: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  valueProp: true,
                },
              },
            },
          },
          bdIntel: true,
        },
      });
    }

    return NextResponse.json(
      {
        personaId: persona.id,
        persona,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('❌ Persona POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create persona' },
      { status: 500 },
    );
  }
}

