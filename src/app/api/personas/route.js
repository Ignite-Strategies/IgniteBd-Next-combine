import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAlignmentScore } from '@/lib/alignmentScore';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

const DEFAULT_COMPANY_HQ_ID = process.env.DEFAULT_COMPANY_HQ_ID || null;

export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

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
        ...(productId ? { productId } : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            valueProp: true,
          },
        },
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
      industry = null,
      goals = null,
      painPoints = null,
      desiredOutcome = null,
      valuePropToPersona = null,
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

    let product = null;
    if (productId) {
      product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          companyHQId: true,
          name: true,
          valueProp: true,
        },
      });

      if (!product) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 },
        );
      }

      if (product.companyHQId !== tenantId) {
        return NextResponse.json(
          { error: 'Product does not belong to this tenant' },
          { status: 403 },
        );
      }
    }

    let alignmentScore = null;
    if (
      alignmentScoreInput !== undefined &&
      alignmentScoreInput !== null &&
      alignmentScoreInput !== ''
    ) {
      const parsed = Number(alignmentScoreInput);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
        alignmentScore = Math.round(parsed);
      } else {
        return NextResponse.json(
          { error: 'alignmentScore must be between 0 and 100 if provided' },
          { status: 400 },
        );
      }
    } else if (product?.valueProp && valuePropToPersona) {
      alignmentScore = await getAlignmentScore(
        product.valueProp,
        valuePropToPersona,
      );
    }

    const personaData = {
      companyHQId: tenantId,
      name,
      role,
      title,
      industry,
      goals,
      painPoints,
      desiredOutcome,
      valuePropToPersona,
      alignmentScore,
      productId: product?.id ?? null,
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
          product: {
            select: {
              id: true,
              name: true,
              valueProp: true,
            },
          },
        },
      });
    } else {
      persona = await prisma.persona.create({
        data: personaData,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              valueProp: true,
            },
          },
        },
      });
    }

    return NextResponse.json(
      {
        personaId: persona.id,
        alignmentScore: persona.alignmentScore,
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

