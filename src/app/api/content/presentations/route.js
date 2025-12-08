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

    console.log('📋 GET /api/content/presentations - companyHQId:', companyHQId, 'published:', published);

    const where = {};
    if (companyHQId) where.companyHQId = companyHQId;
    if (published !== null) where.published = published === 'true';

    // Debug: Check all presentations to see what companyHQIds exist
    const allPresentations = await prisma.presentation.findMany({
      select: {
        id: true,
        companyHQId: true,
        title: true,
      },
      take: 10,
    });
    console.log('🔍 All presentations in DB (first 10):', JSON.stringify(allPresentations, null, 2));

    // Query presentations - don't use select if gamma fields might not exist yet
    const presentations = await prisma.presentation.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`✅ Found ${presentations.length} presentations for companyHQId: ${companyHQId}`);
    if (presentations.length === 0 && companyHQId) {
      console.warn(`⚠️ No presentations found for companyHQId: ${companyHQId}`);
      console.warn(`   Presentations exist for other companyHQIds. Check the logs above.`);
    }

    // Normalize slides structure to ensure outlines are properly hydrated
    const normalizedPresentations = presentations.map((p) => {
      // Ensure slides has the correct structure with sections array
      if (p.slides) {
        // If slides is a string, try to parse it
        if (typeof p.slides === 'string') {
          try {
            p.slides = JSON.parse(p.slides);
          } catch (e) {
            console.warn(`Failed to parse slides JSON for presentation ${p.id}:`, e);
            p.slides = { sections: [] };
          }
        }
        // Ensure slides has sections array
        if (typeof p.slides === 'object' && p.slides !== null) {
          if (!p.slides.sections || !Array.isArray(p.slides.sections)) {
            p.slides.sections = [];
          }
        } else {
          p.slides = { sections: [] };
        }
      } else {
        // If slides is null/undefined, initialize with empty structure
        p.slides = { sections: [] };
      }
      return p;
    });

    return NextResponse.json({
      success: true,
      presentations: normalizedPresentations,
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

