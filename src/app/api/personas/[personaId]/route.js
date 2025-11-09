import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

const DEFAULT_COMPANY_HQ_ID = process.env.DEFAULT_COMPANY_HQ_ID || null;

export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { personaId } = params || {};
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId') || DEFAULT_COMPANY_HQ_ID;

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 },
      );
    }

    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            valueProp: true,
          },
        },
        companyHQ: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    if (!persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 },
      );
    }

    if (companyHQId && persona.companyHQId !== companyHQId) {
      return NextResponse.json(
        { error: 'Persona does not belong to this tenant' },
        { status: 403 },
      );
    }

    return NextResponse.json(persona);
  } catch (error) {
    console.error('❌ Persona detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch persona' },
      { status: 500 },
    );
  }
}

