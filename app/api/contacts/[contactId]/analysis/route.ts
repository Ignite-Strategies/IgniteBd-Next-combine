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
    const { productId } = body;

    // Verify contact exists and belongs to companyHQ
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

    // Generate analysis
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

    // Save to database
    const savedAnalysis = await prisma.contact_analyses.upsert({
      where: { contactId },
      create: {
        contactId,
        fitScore: result.analysis!.fitScore,
        painAlignmentScore: result.analysis!.painAlignmentScore,
        workflowFitScore: result.analysis!.workflowFitScore,
        urgencyScore: result.analysis!.urgencyScore,
        adoptionBarrierScore: result.analysis!.adoptionBarrierScore,
        risks: result.analysis!.risks.length > 0 ? result.analysis!.risks : null,
        opportunities: result.analysis!.opportunities.length > 0 ? result.analysis!.opportunities : null,
        recommendedTalkTrack: result.analysis!.recommendedTalkTrack || null,
        recommendedSequence: result.analysis!.recommendedSequence || null,
        recommendedLeadSource: result.analysis!.recommendedLeadSource || null,
        finalSummary: result.analysis!.finalSummary || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        fitScore: result.analysis!.fitScore,
        painAlignmentScore: result.analysis!.painAlignmentScore,
        workflowFitScore: result.analysis!.workflowFitScore,
        urgencyScore: result.analysis!.urgencyScore,
        adoptionBarrierScore: result.analysis!.adoptionBarrierScore,
        risks: result.analysis!.risks.length > 0 ? result.analysis!.risks : null,
        opportunities: result.analysis!.opportunities.length > 0 ? result.analysis!.opportunities : null,
        recommendedTalkTrack: result.analysis!.recommendedTalkTrack || null,
        recommendedSequence: result.analysis!.recommendedSequence || null,
        recommendedLeadSource: result.analysis!.recommendedLeadSource || null,
        finalSummary: result.analysis!.finalSummary || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      analysis: savedAnalysis,
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

    return NextResponse.json({
      success: true,
      analysis,
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

