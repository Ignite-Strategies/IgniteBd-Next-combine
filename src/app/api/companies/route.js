import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken, optionallyVerifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/companies
 * List companies (prospect/client companies) for a tenant
 * Query params: companyHQId (required)
 */
export async function GET(request) {
  await optionallyVerifyFirebaseToken(request);

  try {
    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const companies = await prisma.company.findMany({
      where: { companyHQId },
      include: {
        contacts: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    return NextResponse.json({
      success: true,
      companies,
    });
  } catch (error) {
    console.error('❌ ListCompanies error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list companies',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/companies
 * Create or find a company (upsert pattern)
 * Follows contact-first pattern: link to tenant, then create based on companyName
 * 
 * Body:
 * - companyHQId (required) - Tenant boundary
 * - companyName (required) - Company name
 * - address, industry, website, revenue, yearsInBusiness (optional)
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
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
      companyName,
      address,
      industry,
      website,
      revenue,
      yearsInBusiness,
    } = body ?? {};

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    if (!companyName) {
      return NextResponse.json(
        { success: false, error: 'companyName is required' },
        { status: 400 },
      );
    }

    // Verify tenant exists
    const companyHQ = await prisma.companyHQ.findUnique({
      where: { id: companyHQId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    // Upsert pattern: find existing or create new
    const normalizedCompanyName = companyName.trim();
    const allCompanies = await prisma.company.findMany({
      where: { companyHQId },
    });

    let company = allCompanies.find(
      (c) =>
        c.companyName &&
        c.companyName.trim().toLowerCase() === normalizedCompanyName.toLowerCase(),
    );

    if (company) {
      // Update existing company if additional data provided
      if (address || industry || website || revenue || yearsInBusiness) {
        company = await prisma.company.update({
          where: { id: company.id },
          data: {
            address: address || company.address,
            industry: industry || company.industry,
            website: website || company.website,
            revenue: revenue || company.revenue,
            yearsInBusiness: yearsInBusiness || company.yearsInBusiness,
          },
        });
      }
      console.log(`✅ Found existing company: ${company.companyName} (id: ${company.id})`);
    } else {
      // Create new company
      company = await prisma.company.create({
        data: {
          companyHQId,
          companyName: normalizedCompanyName,
          address: address || null,
          industry: industry || null,
          website: website || null,
          revenue: revenue || null,
          yearsInBusiness: yearsInBusiness || null,
        },
      });
      console.log(`✅ Created new company: ${normalizedCompanyName} for companyHQId: ${companyHQId}`);
    }

    return NextResponse.json({
      success: true,
      company,
    });
  } catch (error) {
    console.error('❌ CreateCompany error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create company',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

