import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/template-relationship-helpers
 * Create a new TemplateRelationshipHelper
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
    const requestBody = await request.json();
    const {
      ownerId,
      relationshipType,
      familiarityLevel,
      whyReachingOut,
      desiredOutcome,
      timeHorizon,
      contextNotes,
    } = requestBody ?? {};

    if (!ownerId || !relationshipType || !familiarityLevel || !whyReachingOut) {
      return NextResponse.json(
        { success: false, error: 'ownerId, relationshipType, familiarityLevel, and whyReachingOut are required' },
        { status: 400 },
      );
    }

    const helper = await prisma.template_relationship_helpers.create({
      data: {
        ownerId,
        relationshipType: relationshipType.trim(),
        familiarityLevel: familiarityLevel.trim(),
        whyReachingOut: whyReachingOut.trim(),
        desiredOutcome: desiredOutcome?.trim() || null,
        timeHorizon: timeHorizon?.trim() || null,
        contextNotes: contextNotes?.trim() || null,
      },
    });

    console.log('✅ TemplateRelationshipHelper created:', helper.id);

    return NextResponse.json({
      success: true,
      helper,
    });
  } catch (error) {
    console.error('❌ CreateTemplateRelationshipHelper error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create template relationship helper',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/template-relationship-helpers
 * List template relationship helpers
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
    const ownerId = searchParams.get('ownerId');

    const where = {};
    if (ownerId) where.ownerId = ownerId;

    const helpers = await prisma.template_relationship_helpers.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      helpers,
    });
  } catch (error) {
    console.error('❌ ListTemplateRelationshipHelpers error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list template relationship helpers',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

