/**
 * POST /api/contacts/[contactId]/analysis
 * 
 * Generate contact analysis (meeting prep) for a REAL contact.
 * This is separate from personas - this is for actual people you're about to meet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ContactAnalysisMinimalService } from '@/lib/services/ContactAnalysisMinimalService';
// Full service kept for MVP2: import { ContactAnalysisService } from '@/lib/services/ContactAnalysisService';
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

    // Generate minimal analysis (MVP1)
    const result = await ContactAnalysisMinimalService.generate({
      contactId,
      companyHQId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to generate contact analysis',
        },
        { status: 400 }
      );
    }

    // Save to database (using finalSummary field to store the basic info as JSON)
    // For MVP1, we're storing basic persona-like fields (who, company, coreGoal)
    const analysisData = {
      personName: result.analysis!.personName,
      title: result.analysis!.title,
      company: result.analysis!.company,
      coreGoal: result.analysis!.coreGoal,
    };

    const savedAnalysis = await prisma.contact_analyses.upsert({
      where: { contactId },
      create: {
        contactId,
        finalSummary: JSON.stringify(analysisData), // Store basic info in finalSummary for MVP1
        // MVP2 fields left null for now
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        finalSummary: JSON.stringify(analysisData),
        updatedAt: new Date(),
      },
    });

    // Return the analysis data (not the DB record)
    return NextResponse.json({
      success: true,
      analysis: analysisData,
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

