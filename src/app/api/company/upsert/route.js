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
    const owner = await prisma.owner.findUnique({
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
    const existingCompany = await prisma.companyHQ.findFirst({
      where: { ownerId: owner.id },
    });

    let companyHQ;
    let created = false;

    if (existingCompany) {
      // Update existing company
      companyHQ = await prisma.companyHQ.update({
        where: { id: existingCompany.id },
        data: {
          companyName,
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
      // Find IgniteBD root tenant (ultraTenantId = null) to auto-assign as parent
      // This makes new owners "baby CRM" tenants under IgniteBD
      const igniteBDHQ = await prisma.companyHQ.findFirst({
        where: { ultraTenantId: null },
        orderBy: { createdAt: 'asc' }, // Get the first/oldest root tenant
      });
      
      // Create new company
      companyHQ = await prisma.companyHQ.create({
        data: {
          companyName,
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
          ultraTenantId: igniteBDHQ?.id || null, // Auto-assign to IgniteBD if found
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

