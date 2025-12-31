/**
 * POST /api/contacts/[contactId]/analysis
 * 
 * Generate contact analysis (meeting prep) for a REAL contact.
 * This is separate from personas - this is for actual people you're about to meet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ContactAnalysisService } from '@/lib/services/ContactAnalysisService';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { contactId } = await params;
    const body = await request.json();
    const { companyHQId } = body;

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        crmId: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Get productId from body if provided (optional)
    const { productId } = body;

    // Generate full contact analysis with BD Intel scores (MVP1)
    const result = await ContactAnalysisService.generate({
      contactId,
      productId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to generate contact analysis',
          details: result.details,
        },
        { status: 400 }
      );
    }

    const analysisData = result.analysis!;

    // Save to database with full BD Intel scores
    const savedAnalysis = await prisma.contact_analyses.upsert({
      where: { contactId },
      create: {
        contactId,
        fitScore: analysisData.fitScore,
        painAlignmentScore: analysisData.painAlignmentScore,
        workflowFitScore: analysisData.workflowFitScore,
        urgencyScore: analysisData.urgencyScore,
        adoptionBarrierScore: analysisData.adoptionBarrierScore,
        risks: analysisData.risks as any,
        opportunities: analysisData.opportunities as any,
        recommendedTalkTrack: analysisData.recommendedTalkTrack,
        recommendedSequence: analysisData.recommendedSequence,
        recommendedLeadSource: analysisData.recommendedLeadSource,
        finalSummary: analysisData.finalSummary,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        fitScore: analysisData.fitScore,
        painAlignmentScore: analysisData.painAlignmentScore,
        workflowFitScore: analysisData.workflowFitScore,
        urgencyScore: analysisData.urgencyScore,
        adoptionBarrierScore: analysisData.adoptionBarrierScore,
        risks: analysisData.risks as any,
        opportunities: analysisData.opportunities as any,
        recommendedTalkTrack: analysisData.recommendedTalkTrack,
        recommendedSequence: analysisData.recommendedSequence,
        recommendedLeadSource: analysisData.recommendedLeadSource,
        finalSummary: analysisData.finalSummary,
        updatedAt: new Date(),
      },
    });

    // Return the analysis data
    return NextResponse.json({
      success: true,
      analysis: {
        fitScore: savedAnalysis.fitScore,
        painAlignmentScore: savedAnalysis.painAlignmentScore,
        workflowFitScore: savedAnalysis.workflowFitScore,
        urgencyScore: savedAnalysis.urgencyScore,
        adoptionBarrierScore: savedAnalysis.adoptionBarrierScore,
        risks: savedAnalysis.risks as string[] | null,
        opportunities: savedAnalysis.opportunities as string[] | null,
        recommendedTalkTrack: savedAnalysis.recommendedTalkTrack,
        recommendedSequence: savedAnalysis.recommendedSequence,
        recommendedLeadSource: savedAnalysis.recommendedLeadSource,
        finalSummary: savedAnalysis.finalSummary,
      },
    });

  } catch (error: any) {
    console.error('❌ Contact analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate contact analysis',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contacts/[contactId]/analysis
 * 
 * Get existing contact analysis
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { contactId } = await params;

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        crmId: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Get analysis
    const analysis = await prisma.contact_analyses.findUnique({
      where: { contactId },
    });

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Return analysis in expected format
    return NextResponse.json({
      success: true,
      analysis: {
        fitScore: analysis.fitScore,
        painAlignmentScore: analysis.painAlignmentScore,
        workflowFitScore: analysis.workflowFitScore,
        urgencyScore: analysis.urgencyScore,
        adoptionBarrierScore: analysis.adoptionBarrierScore,
        risks: analysis.risks as string[] | null,
        opportunities: analysis.opportunities as string[] | null,
        recommendedTalkTrack: analysis.recommendedTalkTrack,
        recommendedSequence: analysis.recommendedSequence,
        recommendedLeadSource: analysis.recommendedLeadSource,
        finalSummary: analysis.finalSummary,
      },
    });
  } catch (error: any) {
    console.error('❌ Get contact analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch contact analysis',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

