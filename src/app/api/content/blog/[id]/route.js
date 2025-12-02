import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/content/blog/:id
 * Get a single blog
 */
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
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 },
      );
    }

    const blog = await prisma.blog.findUnique({
      where: { id },
    });

    if (!blog) {
      return NextResponse.json(
        { success: false, error: 'Blog not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error('❌ GetBlog error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get blog',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/content/blog/:id
 * Update a blog
 */
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
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { title, subtitle, blogText, sections } = body ?? {};

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (blogText !== undefined) updateData.blogText = blogText;
    if (sections !== undefined) updateData.sections = sections;

    const blog = await prisma.blog.update({
      where: { id },
      data: updateData,
    });

    console.log('✅ Blog updated:', blog.id);

    return NextResponse.json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error('❌ UpdateBlog error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update blog',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/content/blog/:id
 * Delete a blog
 */
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
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 },
      );
    }

    await prisma.blog.delete({
      where: { id },
    });

    console.log('✅ Blog deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'Blog deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeleteBlog error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete blog',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

