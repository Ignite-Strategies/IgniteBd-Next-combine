import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * GET /api/company-hqs/[id]
 * Get a company_hq by ID (with membership check)
 */
export async function GET(request, { params }) {
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
    const resolvedParams = await params;
    const companyHQId = resolvedParams?.id;
    
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 },
      );
    }

    // Get owner from token
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Membership guard
    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 },
      );
    }

    const company = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
      select: {
        id: true,
        companyName: true,
        slug: true,
        ownerId: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      company,
    });
  } catch (error) {
    console.error('❌ GET /api/company-hqs/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch company', details: error?.message },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/company-hqs/[id]
 * Update company_hq fields (including slug)
 * Body: { slug?: string, companyName?: string, ... }
 */
export async function PATCH(request, { params }) {
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
    const resolvedParams = await params;
    const companyHQId = resolvedParams?.id;
    
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 },
      );
    }

    // Get owner from token
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Membership guard
    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { slug, ...otherFields } = body;

    const updateData = {};
    
    // Validate and normalize slug if provided
    if (slug !== undefined) {
      if (slug === null || slug === '') {
        updateData.slug = null;
      } else {
        const normalizedSlug = String(slug)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        
        if (!normalizedSlug) {
          return NextResponse.json(
            { success: false, error: 'Invalid slug format' },
            { status: 400 },
          );
        }
        
        // Check if slug is already taken by another company
        const existing = await prisma.company_hqs.findUnique({
          where: { slug: normalizedSlug },
          select: { id: true },
        });
        
        if (existing && existing.id !== companyHQId) {
          return NextResponse.json(
            { success: false, error: 'Slug already taken' },
            { status: 409 },
          );
        }
        
        updateData.slug = normalizedSlug;
      }
    }

    // Add other allowed fields
    const allowedFields = ['companyName', 'companyStreet', 'companyCity', 'companyState', 'companyZip', 'companyWebsite'];
    for (const field of allowedFields) {
      if (otherFields[field] !== undefined) {
        updateData[field] = otherFields[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 },
      );
    }

    const company = await prisma.company_hqs.update({
      where: { id: companyHQId },
      data: updateData,
      select: {
        id: true,
        companyName: true,
        slug: true,
        ownerId: true,
      },
    });

    return NextResponse.json({
      success: true,
      company,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Slug already taken' },
        { status: 409 },
      );
    }
    console.error('❌ PATCH /api/company-hqs/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update company', details: error?.message },
      { status: 500 },
    );
  }
}
