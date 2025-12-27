import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/templates
 * Create a new email template
 * 
 * Body:
 * - ownerId (required) - from useOwner hook
 * - title (required)
 * - subject (required)
 * - body (required)
 * 
 * Returns:
 * - template: Created template
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
    const { ownerId, title, subject, body: bodyText } = body;

    // Validate required fields
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'ownerId is required' },
        { status: 400 },
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 },
      );
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json(
        { success: false, error: 'subject is required' },
        { status: 400 },
      );
    }

    if (!bodyText || !bodyText.trim()) {
      return NextResponse.json(
        { success: false, error: 'body is required' },
        { status: 400 },
      );
    }

    // Create template with ownerId from request body (from useOwner hook)
    const template = await prisma.template.create({
      data: {
        ownerId,
        title: title.trim(),
        subject: subject.trim(),
        body: bodyText.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('❌ CreateTemplate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create template',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/templates
 * List email templates for the authenticated owner
 * 
 * Query params:
 * - ownerId (required) - from useOwner hook
 * 
 * Returns:
 * - success: boolean
 * - templates: array of templates owned by the owner
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

    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'ownerId query parameter is required' },
        { status: 400 },
      );
    }

    // List templates for this owner
    const templates = await prisma.template.findMany({
      where: {
        ownerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('❌ ListTemplates error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list templates',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
