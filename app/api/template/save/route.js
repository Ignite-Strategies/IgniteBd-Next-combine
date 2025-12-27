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
    const { templateBaseId, content, subjectLine, mode, companyHQId } = body ?? {};

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

    // Verify templateBase exists and get companyHQId
    const templateBase = await prisma.template_bases.findUnique({
      where: { id: templateBaseId },
    });

    if (!templateBase) {
      return NextResponse.json(
        { error: 'TemplateBase not found' },
        { status: 404 },
      );
    }

    const tenantId = companyHQId || templateBase.companyHQId;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Save to templates model with: title (name), subjectline (subject), templatecontent (body), datecreated (createdAt)
    const template = await prisma.template.create({
      data: {
        companyHQId: tenantId,
        name: templateBase.title, // title -> name
        subject: subjectLine?.trim() || null, // subjectline -> subject
        body: content.trim(), // templatecontent -> body
        type: 'outreach',
        published: false,
      },
    });

    // Also save to outreach_templates for backward compatibility
    const outreachTemplate = await prisma.outreach_templates.create({
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
        template: {
          id: template.id,
          title: template.name,
          subjectLine: template.subject,
          templateContent: template.body,
          dateCreated: template.createdAt,
        },
        outreachTemplate, // Keep for backward compatibility
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

