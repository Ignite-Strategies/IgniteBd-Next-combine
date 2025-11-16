import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/templates/phases
 * Get all Phase Templates
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const phaseTemplates = await prisma.phaseTemplate.findMany({
      where: { companyHQId },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`✅ GET /api/templates/phases: Returning ${phaseTemplates.length} templates for ${companyHQId}`);

    return NextResponse.json({
      success: true,
      phaseTemplates,
    });
  } catch (error) {
    console.error('❌ GetPhaseTemplates error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get phase templates',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

