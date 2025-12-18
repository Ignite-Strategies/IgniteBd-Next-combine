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
      title,
      relationship,
      typeOfPerson,
      whyReachingOut,
      whatWantFromThem,
      // Template context fields
      timeSinceConnected,
      timeHorizon,
      knowledgeOfBusiness,
      myBusinessDescription,
      desiredOutcome,
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

    // Generate default title if not provided
    let finalTitle = title?.trim();
    if (!finalTitle) {
      const typeLabels = {
        CURRENT_CLIENT: 'Current Client',
        FORMER_CLIENT: 'Former Client',
        FORMER_COWORKER: 'Former Co-worker',
        PROSPECT: 'Prospect',
        PARTNER: 'Partner',
        FRIEND_OF_FRIEND: 'Friend',
      };
      const typeLabel = typeLabels[typeOfPerson] || 'Contact';
      finalTitle = `Outreach to ${typeLabel}`;
    }

    const templateBase = await prisma.template_bases.create({
      data: {
        companyHQId: tenantId,
        title: finalTitle,
        relationship,
        typeOfPerson,
        whyReachingOut: whyReachingOut.trim(),
        whatWantFromThem: whatWantFromThem?.trim() || null,
        // Template context fields
        timeSinceConnected: timeSinceConnected?.trim() || null,
        timeHorizon: timeHorizon?.trim() || null,
        knowledgeOfBusiness: knowledgeOfBusiness ?? false,
        myBusinessDescription: myBusinessDescription?.trim() || null,
        desiredOutcome: desiredOutcome?.trim() || null,
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

