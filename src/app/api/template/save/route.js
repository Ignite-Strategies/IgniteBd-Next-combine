import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

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
    const { templateBaseId, content, mode } = body ?? {};

    if (!templateBaseId) {
      return NextResponse.json(
        { error: 'templateBaseId is required' },
        { status: 400 },
      );
    }

    if (!content || content.trim() === '') {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 },
      );
    }

    if (!mode || (mode !== 'MANUAL' && mode !== 'AI')) {
      return NextResponse.json(
        { error: 'mode must be either MANUAL or AI' },
        { status: 400 },
      );
    }

    // Verify templateBase exists
    const templateBase = await prisma.template_bases.findUnique({
      where: { id: templateBaseId },
    });

    if (!templateBase) {
      return NextResponse.json(
        { error: 'TemplateBase not found' },
        { status: 404 },
      );
    }

    const template = await prisma.outreach_templates.create({
      data: {
        templateBaseId,
        content: content.trim(),
        mode,
      },
      include: {
        template_bases: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        template,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('❌ Template save error:', error);
    return NextResponse.json(
      { error: 'Failed to save template' },
      { status: 500 },
    );
  }
}
