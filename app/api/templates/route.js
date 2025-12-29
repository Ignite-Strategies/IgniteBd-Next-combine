import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * POST /api/templates
 * Create a new email template (company-scoped)
 * 
 * Body:
 * - companyHQId (required) - company to create template for
 * - title (required)
 * - subject (required)
 * - body (required)
 * - ownerId (optional) - creator/audit trail
 * 
 * Returns:
 * - template: Created template
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Get owner from Firebase token
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { companyHQId, ownerId, title, subject, body: bodyText } = body;

    // Validate required fields
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Validate membership - owner must have access to this companyHQ
    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this company' },
        { status: 403 },
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

    // Create template (company-scoped, ownerId optional for audit trail)
    const template = await prisma.templates.create({
      data: {
        companyHQId,
        ownerId: ownerId || owner.id, // Use provided ownerId or current owner as creator
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
 * List email templates for a company (company-scoped)
 * 
 * Query params:
 * - companyHQId (required) - company to list templates for
 * 
 * Returns:
 * - success: boolean
 * - templates: array of templates for the company
 */
export async function GET(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Get owner from Firebase token
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId query parameter is required' },
        { status: 400 },
      );
    }

    // Validate membership - owner must have access to this companyHQ
    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this company' },
        { status: 403 },
      );
    }

    // List templates for this company (company-scoped)
    const templates = await prisma.templates.findMany({
      where: {
        companyHQId,
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
