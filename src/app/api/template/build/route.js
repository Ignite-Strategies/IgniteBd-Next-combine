import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

const DEFAULT_COMPANY_HQ_ID = process.env.DEFAULT_COMPANY_HQ_ID || null;

export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      companyHQId,
      relationship,
      typeOfPerson,
      whyReachingOut,
      whatWantFromThem,
    } = body ?? {};

    const tenantId = companyHQId || DEFAULT_COMPANY_HQ_ID;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    if (!relationship) {
      return NextResponse.json(
        { error: 'relationship is required' },
        { status: 400 },
      );
    }

    if (!typeOfPerson) {
      return NextResponse.json(
        { error: 'typeOfPerson is required' },
        { status: 400 },
      );
    }

    if (!whyReachingOut || whyReachingOut.trim() === '') {
      return NextResponse.json(
        { error: 'whyReachingOut is required' },
        { status: 400 },
      );
    }

    const templateBase = await prisma.template_bases.create({
      data: {
        companyHQId: tenantId,
        relationship,
        typeOfPerson,
        whyReachingOut: whyReachingOut.trim(),
        whatWantFromThem: whatWantFromThem?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        templateBase,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('❌ TemplateBase POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create template base' },
      { status: 500 },
    );
  }
}

