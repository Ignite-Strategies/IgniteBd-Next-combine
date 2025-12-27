import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 },
      );
    }

    const template = await prisma.templates.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('❌ GetTemplate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get template',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 },
      );
    }

    const requestBody = await request.json();
    const {
      title,   // was name
      subject,
      body,
    } = requestBody ?? {};

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (subject !== undefined) updateData.subject = subject.trim();
    if (body !== undefined) updateData.body = body.trim();

    const template = await prisma.templates.update({
      where: { id },
      data: updateData,
    });

    console.log('✅ Template updated:', template.id);

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('❌ UpdateTemplate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update template',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 },
      );
    }

    await prisma.templates.delete({
      where: { id },
    });

    console.log('✅ Template deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeleteTemplate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete template',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
