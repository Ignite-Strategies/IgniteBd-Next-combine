import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { randomUUID } from 'crypto';

/**
 * POST /api/content/blog
 * Create a new blog or upsert if id is provided
 * Requires: ownerId (from Firebase token) - verifies access through companyHQ
 */
export async function POST(request) {
  let firebaseUser;
  let owner;
  
  try {
    firebaseUser = await verifyFirebaseToken(request);
    
    // Get owner
    owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      id, // Optional - if provided, upsert
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

    // Verify companyHQ belongs to owner
    const companyHQ = await prisma.company_hqs.findFirst({
      where: {
        id: companyHQId,
        ownerId: owner.id,
      },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found or access denied' },
        { status: 403 },
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
          .join('\n');
      }
      
      // Store sections structure
      finalSections = blogDraft;
    }

    // Upsert: update if id provided, otherwise create
    const blogData = {
      companyHQId,
      title: title || null,
      subtitle: subtitle || null,
      blogText: finalBlogText || null,
      sections: finalSections || null,
      presenter: presenter || null,
      description: description || null,
    };

    let blog;
    if (id) {
      // Update existing blog
      blog = await prisma.blogs.update({
        where: { id },
        data: blogData,
      });
      console.log('✅ Blog updated:', blog.id);
    } else {
      // Create new blog
      blog = await prisma.blogs.create({
        data: {
          id: randomUUID(),
          ...blogData,
        },
      });
      console.log('✅ Blog created:', blog.id);
    }

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

    const blogs = await prisma.blogs.findMany({
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

