import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/content/blog
 * Create a new blog
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
      subtitle,
      blogText,
      sections,
      presenter,
      description,
      blogDraft, // Accept BlogDraft from AI generation
    } = body ?? {};

    if (!companyHQId || !title) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and title are required' },
        { status: 400 },
      );
    }

    // If blogDraft is provided, merge sections into blogText
    let finalBlogText = blogText;
    let finalSections = sections;

    if (blogDraft) {
      // Merge body sections into blogText (paragraphs only, no headings for easy copy/paste)
      if (blogDraft.body && blogDraft.body.sections && Array.isArray(blogDraft.body.sections)) {
        finalBlogText = blogDraft.body.sections
          .map((section) => section.content || '')
          .filter((content) => content && content.trim()) // Remove empty sections
          .join('\n\n');
      }
      
      // Store sections structure
      finalSections = blogDraft;
    }

    const blog = await prisma.blog.create({
      data: {
        companyHQId,
        title: title || null,
        subtitle: subtitle || null,
        blogText: finalBlogText || null,
        sections: finalSections || null,
        presenter: presenter || null,
        description: description || null,
      },
    });

    console.log('✅ Blog created:', blog.id);

    return NextResponse.json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error('❌ CreateBlog error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create blog',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/content/blog
 * List blogs
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

    const where = {};
    if (companyHQId) where.companyHQId = companyHQId;

    const blogs = await prisma.blog.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      blogs,
    });
  } catch (error) {
    console.error('❌ ListBlogs error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list blogs',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

