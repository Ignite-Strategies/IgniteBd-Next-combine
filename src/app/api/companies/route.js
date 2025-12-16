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
    const query = searchParams.get('query');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const where = { companyHQId };
    if (query) {
      where.companyName = {
        contains: query,
        mode: 'insensitive',
      };
    }

    const companies = await prisma.companies.findMany({
      where,
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
    const companyHQ = await prisma.company_hqs.findUnique({
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
    
    if (!normalizedCompanyName) {
      return NextResponse.json(
        { success: false, error: 'Company name cannot be empty' },
        { status: 400 },
      );
    }

    // Use a transaction-like approach: try to find, then create if not found
    // First try exact match (fastest)
    let company = await prisma.companies.findFirst({
      where: {
        companyHQId,
        companyName: normalizedCompanyName,
      },
    });

    // If not found, try case-insensitive match using a more efficient query
    if (!company) {
      // Get all companies for this tenant (unavoidable for case-insensitive match)
      // But we'll optimize by only selecting what we need
      const allCompanies = await prisma.companies.findMany({
        where: { companyHQId },
        select: { id: true, companyName: true },
      });

      const normalizedSearch = normalizedCompanyName.toLowerCase().trim();
      const found = allCompanies.find(
        (c) => c.companyName && c.companyName.trim().toLowerCase() === normalizedSearch
      );
      
      if (found) {
        company = await prisma.companies.findUnique({
          where: { id: found.id },
        });
      }
    }

    if (company) {
      // Update existing company if additional data provided
      const updateData = {};
      if (address !== undefined) updateData.address = address;
      if (industry !== undefined) updateData.industry = industry;
      if (website !== undefined) updateData.website = website;
      if (revenue !== undefined) updateData.revenue = revenue;
      if (yearsInBusiness !== undefined) updateData.yearsInBusiness = yearsInBusiness;

      if (Object.keys(updateData).length > 0) {
        company = await prisma.companies.update({
          where: { id: company.id },
          data: updateData,
        });
      }
      console.log(`✅ Found existing company: ${company.companyName} (id: ${company.id})`);
    } else {
      // Create new company - simple create, let Prisma handle duplicates
      try {
        company = await prisma.companies.create({
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
        console.log(`✅ Created new company: ${normalizedCompanyName} (id: ${company.id})`);
      } catch (createError) {
        console.error('❌ Create company error:', createError);
        // If it's a unique constraint error, try to find the existing one
        if (createError.code === 'P2002') {
          console.log('⚠️ Unique constraint violation, searching for existing company...');
          // One more search attempt
          const retryCompanies = await prisma.companies.findMany({
            where: { companyHQId },
            select: { id: true, companyName: true },
          });
          const normalizedSearch = normalizedCompanyName.toLowerCase().trim();
          const found = retryCompanies.find(
            (c) => c.companyName && c.companyName.trim().toLowerCase() === normalizedSearch
          );
          if (found) {
            company = await prisma.companies.findUnique({
              where: { id: found.id },
            });
            console.log(`✅ Found existing company after error: ${company.companyName} (id: ${company.id})`);
          } else {
            // Re-throw with better error message
            return NextResponse.json(
              {
                success: false,
                error: 'Failed to create company - duplicate detected but not found',
                details: createError.message,
              },
              { status: 500 },
            );
          }
        } else {
          // Re-throw other errors
          throw createError;
        }
      }
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

