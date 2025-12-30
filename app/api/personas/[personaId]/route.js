import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

const DEFAULT_COMPANY_HQ_ID = process.env.DEFAULT_COMPANY_HQ_ID || null;

export async function GET(request, { params }) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    console.error('❌ Firebase token verification failed:', error.message);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Handle async params (Next.js 15)
    const resolvedParams = params && typeof params.then === 'function' ? await params : params;
    const { personaId } = resolvedParams || {};
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId') || DEFAULT_COMPANY_HQ_ID;

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 },
      );
    }

    if (!companyHQId) {
      return NextResponse.json(
        { error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Get owner from firebaseId
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true }
    });

    if (!owner) {
      return NextResponse.json(
        { error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Membership guard - ensure user has access to this CompanyHQ
    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json(
        { error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 },
      );
    }

    const persona = await prisma.personas.findUnique({
      where: { id: personaId },
      include: {
        product_fits: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                valueProp: true,
                description: true,
                price: true,
                priceCurrency: true,
              },
            },
          },
        },
        // bd_intels removed - migrating to contact_analyses
        // bd_intels: true,
        company_hqs: {
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

    // Verify persona belongs to the requested companyHQId
    if (persona.companyHQId !== companyHQId) {
      return NextResponse.json(
        { error: 'Persona does not belong to this CompanyHQ' },
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

