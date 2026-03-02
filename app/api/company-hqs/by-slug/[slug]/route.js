import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * GET /api/company-hqs/by-slug/[slug]
 * Get a company_hq by slug (for cockpit routes)
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
    const slug = resolvedParams?.slug;
    
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Slug is required' },
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

    // Find company by slug
    const company = await prisma.company_hqs.findUnique({
      where: { slug },
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

    // Membership guard
    const { membership } = await resolveMembership(owner.id, company.id);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      company,
    });
  } catch (error) {
    console.error('❌ GET /api/company-hqs/by-slug/[slug] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch company', details: error?.message },
      { status: 500 },
    );
  }
}
