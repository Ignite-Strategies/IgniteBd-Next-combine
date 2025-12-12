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
        { success: false, error: 'Presentation ID is required' },
        { status: 400 },
      );
    }

    const presentation = await prisma.presentation.findUnique({
      where: { id },
    });

    if (!presentation) {
      return NextResponse.json(
        { success: false, error: 'Presentation not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      presentation,
    });
  } catch (error) {
    console.error('❌ GetPresentation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get presentation',
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
        { success: false, error: 'Presentation ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      slides,
      published,
    } = body ?? {};

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (slides !== undefined) updateData.slides = slides;
    if (published !== undefined) {
      updateData.published = published;
      updateData.publishedAt = published ? new Date() : null;
    }

    const presentation = await prisma.presentation.update({
      where: { id },
      data: updateData,
    });

    console.log('✅ Presentation updated:', presentation.id);

    return NextResponse.json({
      success: true,
      presentation,
    });
  } catch (error) {
    console.error('❌ UpdatePresentation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update presentation',
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
        { success: false, error: 'Presentation ID is required' },
        { status: 400 },
      );
    }

    await prisma.presentation.delete({
      where: { id },
    });

    console.log('✅ Presentation deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'Presentation deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeletePresentation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete presentation',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
