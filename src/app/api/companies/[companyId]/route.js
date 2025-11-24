import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/companies/[companyId]
 * 
 * Get company by ID with all related contacts
 */
export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { companyId } = params || {};
    
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 },
      );
    }

    // Resolve params if it's a Promise (Next.js 15+)
    const resolvedParams = typeof params.then === 'function' ? await params : params;
    const finalCompanyId = resolvedParams?.companyId || companyId;

    const company = await prisma.company.findUnique({
      where: { id: finalCompanyId },
      include: {
        contacts: {
          include: {
            pipeline: true,
            company: true,
            contactCompany: true, // Legacy
          },
          orderBy: { createdAt: 'desc' },
        },
        companyHQ: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      company,
    });
  } catch (error) {
    console.error('❌ GetCompany error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch company',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

