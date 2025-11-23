import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/content/presentations
 * Create a new presentation (uses CleDeck model)
 */
export async function POST(request) {
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
    const {
      companyHQId,
      title,
      slides,
      presenter,
      description,
      published = false,
    } = body ?? {};

    if (!companyHQId || !title) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and title are required' },
        { status: 400 },
      );
    }

    const presentation = await prisma.presentation.create({
      data: {
        companyHQId,
        title: title || null,
        slides: slides || null,
        presenter: presenter || null,
        description: description || null,
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
 * List presentations (uses CleDeck model)
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');
    const published = searchParams.get('published');

    const where = {};
    if (companyHQId) where.companyHQId = companyHQId;
    if (published !== null) where.published = published === 'true';

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

