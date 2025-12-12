import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/content/presentations
 * Create a new presentation
 * Requires: ownerId (from Firebase token)
 */
export async function POST(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get owner
    const owner = await prisma.owner.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const {
      companyHQId,
      title,
      description,
      slides,
      published = false,
    } = body ?? {};

    if (!companyHQId || !title) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and title are required' },
        { status: 400 },
      );
    }

    // Verify companyHQ belongs to owner
    const companyHQ = await prisma.companyHQ.findFirst({
      where: {
        id: companyHQId,
        ownerId: owner.id,
      },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found or access denied' },
        { status: 403 },
      );
    }

    const presentation = await prisma.presentation.create({
      data: {
        companyHQId,
        title,
        description: description || null,
        slides: slides || null,
        published,
        publishedAt: published ? new Date() : null,
      },
    });

    console.log('✅ Presentation created:', presentation.id);

    return NextResponse.json({
      success: true,
      presentation,
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    console.error('❌ CreatePresentation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create presentation',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/content/presentations
 * List presentations
 * Requires: ownerId (from Firebase token)
 * Filters by owner's companyHQs
 */
export async function GET(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get owner
    const owner = await prisma.owner.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Get owner's companyHQs
    const ownerCompanyHQs = await prisma.companyHQ.findMany({
      where: { ownerId: owner.id },
      select: { id: true },
    });

    const ownerCompanyHQIds = ownerCompanyHQs.map((hq) => hq.id);

    if (ownerCompanyHQIds.length === 0) {
      return NextResponse.json({
        success: true,
        presentations: [],
      });
    }

    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');
    const published = searchParams.get('published');

    const where = {
      companyHQId: {
        in: ownerCompanyHQIds,
      },
    };
    
    // If specific companyHQId requested, verify it belongs to owner
    if (companyHQId) {
      if (!ownerCompanyHQIds.includes(companyHQId)) {
        return NextResponse.json(
          { success: false, error: 'Access denied to this companyHQ' },
          { status: 403 },
        );
      }
      where.companyHQId = companyHQId;
    }
    
    if (published !== null) {
      where.published = published === 'true';
    }

    const presentations = await prisma.presentation.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      presentations,
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    console.error('❌ ListPresentations error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list presentations',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
