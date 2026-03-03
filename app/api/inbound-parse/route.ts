import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/inbound-parse
 * 
 * Get all InboundEmail records (raw ingestion bucket).
 * Returns emails received via SendGrid Inbound Parse.
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId'); // Company-scoped filtering

    // Get recent inbound emails (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inboundEmails = await prisma.inboundEmail.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        ...(companyHQId && { companyHQId }), // Filter by company (company-scoped)
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to recent 100
    });

    return NextResponse.json({
      success: true,
      emails: inboundEmails,
      count: inboundEmails.length,
    });
  } catch (error) {
    console.error('❌ Get inbound parse emails error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch inbound emails',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
