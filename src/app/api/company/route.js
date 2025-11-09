import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function POST(request) {
  try {
    let firebaseUser = null;
    try {
      firebaseUser = await verifyFirebaseToken(request);
    } catch (error) {
      console.warn('Company create proceeding without verified token:', error?.message);
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
      ownerId,
    } = body ?? {};

    if (!companyName) {
      return NextResponse.json(
        { success: false, error: 'Company name is required' },
        { status: 400 },
      );
    }

    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'Owner ID is required' },
        { status: 400 },
      );
    }

    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    if (firebaseUser && firebaseUser.uid !== owner.firebaseId) {
      console.warn('Owner mismatch between token and payload. Continuing but verify upstream logic.');
    }

    const companyHQ = await prisma.companyHQ.create({
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
        ownerId,
      },
      include: {
        owner: true,
        manager: true,
      },
    });

    console.log('✅ CompanyHQ created:', companyHQ.id);

    return NextResponse.json({
      success: true,
      companyHQ,
    });
  } catch (error) {
    console.error('❌ CreateCompanyHQ error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create company',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

