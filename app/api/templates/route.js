import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/templates
 * Create a new email template
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
      ownerId, // was companyHQId
      title,   // was name
      subject,
      body,
    } = requestBody ?? {};

    if (!ownerId || !title) {
      return NextResponse.json(
        { success: false, error: 'ownerId and title are required' },
        { status: 400 },
      );
    }

    if (!subject || !body) {
      return NextResponse.json(
        { success: false, error: 'subject and body are required' },
        { status: 400 },
      );
    }

    const template = await prisma.templates.create({
      data: {
        ownerId,
        title: title.trim(),
        subject: subject.trim(),
        body: body.trim(),
      },
    });

    console.log('✅ Template created:', template.id);

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
 * List email templates
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
    const ownerId = searchParams.get('ownerId'); // was companyHQId

    const where = {};
    if (ownerId) where.ownerId = ownerId;

    const templates = await prisma.templates.findMany({
      where,
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
