import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * PUT /api/company/[companyId]
 * 
 * Update CompanyHQ
 */
export async function PUT(request, { params }) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    const { companyId } = params || {};
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 },
      );
    }

    // Get owner to verify ownership
    const owner = await prisma.owner.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Verify company exists and belongs to owner
    const companyHQ = await prisma.companyHQ.findUnique({
      where: { id: companyId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    if (companyHQ.ownerId !== owner.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - You do not own this company' },
        { status: 403 },
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

    // Build update data
    const updateData = {};
    if (companyName !== undefined) updateData.companyName = companyName;
    if (whatYouDo !== undefined) updateData.whatYouDo = whatYouDo || null;
    if (companyStreet !== undefined) updateData.companyStreet = companyStreet || null;
    if (companyCity !== undefined) updateData.companyCity = companyCity || null;
    if (companyState !== undefined) updateData.companyState = companyState || null;
    if (companyWebsite !== undefined) updateData.companyWebsite = companyWebsite || null;
    if (companyIndustry !== undefined) updateData.companyIndustry = companyIndustry || null;
    if (companyAnnualRev !== undefined) updateData.companyAnnualRev = companyAnnualRev || null;
    if (yearsInBusiness !== undefined) updateData.yearsInBusiness = yearsInBusiness || null;
    if (teamSize !== undefined) updateData.teamSize = teamSize || null;

    // Update company
    const updatedCompany = await prisma.companyHQ.update({
      where: { id: companyId },
      data: updateData,
      include: {
        owner: true,
        manager: true,
      },
    });

    console.log('✅ CompanyHQ updated:', updatedCompany.id);

    return NextResponse.json({
      success: true,
      companyHQ: updatedCompany,
    });
  } catch (error) {
    console.error('❌ UpdateCompanyHQ error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update company',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

