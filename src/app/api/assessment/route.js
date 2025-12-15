import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import AssessmentCalculationService from '@/lib/services/AssessmentCalculationService';

/**
 * POST /api/assessment
 * Submit a new assessment and generate insights
 */
export async function POST(request) {
  let firebaseUser;
  let owner;

  try {
    firebaseUser = await verifyFirebaseToken(request);
    
    // Get Owner record
    owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {

    const body = await request.json();
    const {
      companyHQId,
      name,
      company,
      industry,
      workTooMuch,
      assignTasks,
      wantMoreClients,
      revenueGrowthPercent,
      totalVolume,
      bdSpend,
    } = body ?? {};

    // Validate required fields
    if (!name || !company) {
      return NextResponse.json(
        { success: false, error: 'Name and company are required' },
        { status: 400 },
      );
    }

    // Prepare assessment data
    const assessmentData = {
      name,
      company,
      industry: industry || null,
      workTooMuch: workTooMuch || null,
      assignTasks: assignTasks || null,
      wantMoreClients: wantMoreClients || null,
      revenueGrowthPercent: revenueGrowthPercent ? parseFloat(revenueGrowthPercent) : null,
      totalVolume: totalVolume ? parseFloat(totalVolume) : null,
      bdSpend: bdSpend ? parseFloat(bdSpend) : null,
    };

    // Generate insights using AssessmentCalculationService
    const insightsResult = await AssessmentCalculationService.generateAssessmentInsights(assessmentData);
    
    // Get score interpretation
    const scoreInterpretation = AssessmentCalculationService.getScoreInterpretation(insightsResult.score);

    // Create assessment record
    const assessment = await prisma.assessment.create({
      data: {
        ownerId: owner.id,
        companyHQId: companyHQId || null,
        name: assessmentData.name,
        company: assessmentData.company,
        industry: assessmentData.industry,
        workTooMuch: assessmentData.workTooMuch,
        assignTasks: assessmentData.assignTasks,
        wantMoreClients: assessmentData.wantMoreClients,
        revenueGrowthPercent: assessmentData.revenueGrowthPercent,
        totalVolume: assessmentData.totalVolume,
        bdSpend: assessmentData.bdSpend,
        score: insightsResult.score,
        scoreInterpretation: scoreInterpretation.level,
        relateWithUser: insightsResult.insights.relateWithUser,
        growthNeeds: insightsResult.insights.growthNeeds,
        rawGptResponse: insightsResult.rawGptResponse || null,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        companyHQ: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    console.log('✅ Assessment created:', assessment.id);

    return NextResponse.json({
      success: true,
      assessment: {
        ...assessment,
        scoreInterpretation: {
          level: scoreInterpretation.level,
          description: scoreInterpretation.description,
          color: scoreInterpretation.color,
        },
      },
    });
  } catch (error) {
    console.error('❌ CreateAssessment error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create assessment',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/assessment
 * Get assessments for the current user
 */
export async function GET(request) {
  let firebaseUser;
  let owner;

  try {
    firebaseUser = await verifyFirebaseToken(request);
    
    // Get Owner record
    owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {

    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');

    const where = {
      ownerId: owner.id,
    };

    if (companyHQId) {
      where.companyHQId = companyHQId;
    }

    const assessments = await prisma.assessment.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        companyHQ: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Add score interpretation to each assessment
    const assessmentsWithInterpretation = assessments.map((assessment) => {
      const interpretation = assessment.score !== null
        ? AssessmentCalculationService.getScoreInterpretation(assessment.score)
        : null;
      
      return {
        ...assessment,
        scoreInterpretation: interpretation ? {
          level: interpretation.level,
          description: interpretation.description,
          color: interpretation.color,
        } : null,
      };
    });

    return NextResponse.json({
      success: true,
      assessments: assessmentsWithInterpretation,
    });
  } catch (error) {
    console.error('❌ GetAssessments error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get assessments',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

