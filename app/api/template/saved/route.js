import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken, optionallyVerifyFirebaseToken } from '@/lib/firebaseAdmin';

const DEFAULT_COMPANY_HQ_ID = process.env.DEFAULT_COMPANY_HQ_ID || null;

export async function GET(request) {
  // Use optionalAuth for GET requests (read operations)
  await optionallyVerifyFirebaseToken(request);

  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId') || DEFAULT_COMPANY_HQ_ID;

    if (!companyHQId) {
      return NextResponse.json(
        { error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Get all saved templates for this company, with their template bases, variables, and business context
    const templates = await prisma.outreach_templates.findMany({
      where: {
        template_bases: {
          companyHQId,
        },
      },
      include: {
        template_bases: {
          select: {
            id: true,
            title: true,
            relationship: true,
            typeOfPerson: true,
            whyReachingOut: true,
            whatWantFromThem: true,
            // Business context fields
            timeSinceConnected: true,
            timeHorizon: true,
            knowledgeOfBusiness: true,
            myBusinessDescription: true,
            desiredOutcome: true,
            contextNotes: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        template_variables: {
          select: {
            id: true,
            variableName: true,
            variableType: true,
            description: true,
            isRequired: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('❌ Templates GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 },
    );
  }
}

