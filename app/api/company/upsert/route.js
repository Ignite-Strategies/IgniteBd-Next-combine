import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * PUT /api/company/upsert
 * 
 * Create or update CompanyHQ (upsert)
 */
export async function PUT(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    // Get owner
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
    const {
      companyName,
      slug,
      whatYouDo,
      companyStreet,
      companyCity,
      companyState,
      companyWebsite,
      companyIndustry,
      companyAnnualRev,
      yearsInBusiness,
      teamSize,
    } = body ?? {};

    if (!companyName) {
      return NextResponse.json(
        { success: false, error: 'Company name is required' },
        { status: 400 },
      );
    }

    // Check if owner already has a company
    const existingCompany = await prisma.company_hqs.findFirst({
      where: { ownerId: owner.id },
    });

    // Normalize slug if provided
    let normalizedSlug = null;
    if (slug && slug.trim()) {
      normalizedSlug = slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (!normalizedSlug) {
        normalizedSlug = null;
      } else {
        // Check if slug is already taken by another company (exclude current company if updating)
        const existingBySlug = await prisma.company_hqs.findFirst({
          where: { 
            slug: normalizedSlug,
            ...(existingCompany ? { id: { not: existingCompany.id } } : {}),
          },
        });
        if (existingBySlug) {
          return NextResponse.json(
            { success: false, error: 'Slug already taken' },
            { status: 409 },
          );
        }
      }
    }

    let companyHQ;
    let created = false;

    if (existingCompany) {
      // Update existing company
      companyHQ = await prisma.company_hqs.update({
        where: { id: existingCompany.id },
        data: {
          companyName,
          slug: normalizedSlug !== undefined ? normalizedSlug : undefined,
          whatYouDo: whatYouDo || null,
          companyStreet: companyStreet || null,
          companyCity: companyCity || null,
          companyState: companyState || null,
          companyWebsite: companyWebsite || null,
          companyIndustry: companyIndustry || null,
          companyAnnualRev: companyAnnualRev || null,
          yearsInBusiness: yearsInBusiness || null,
          teamSize: teamSize || null,
        },
        include: {
          owner: true,
          manager: true,
        },
      });
      console.log('✅ CompanyHQ updated:', companyHQ.id);
    } else {
      // Create new company
      // Generate slug from companyName if not provided
      let finalSlug = normalizedSlug;
      if (!finalSlug && companyName) {
        finalSlug = companyName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        if (!finalSlug) {
          finalSlug = null;
        }
      }

      companyHQ = await prisma.company_hqs.create({
        data: {
          companyName,
          slug: finalSlug,
          whatYouDo: whatYouDo || null,
          companyStreet: companyStreet || null,
          companyCity: companyCity || null,
          companyState: companyState || null,
          companyWebsite: companyWebsite || null,
          companyIndustry: companyIndustry || null,
          companyAnnualRev: companyAnnualRev || null,
          yearsInBusiness: yearsInBusiness || null,
          teamSize: teamSize || null,
          ownerId: owner.id,
          platform: {
            connect: { id: 'platform-ignitebd-001' }
          },
        },
        include: {
          owner: true,
          manager: true,
        },
      });
      created = true;
      console.log('✅ CompanyHQ created:', companyHQ.id);
    }

    return NextResponse.json({
      success: true,
      companyHQ,
      created,
    });
  } catch (error) {
    console.error('❌ CompanyHQ upsert error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save company',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

