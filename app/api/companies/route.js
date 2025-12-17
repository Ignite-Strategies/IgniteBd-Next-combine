import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
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

    // Extract and normalize domain from website if provided
    // Domain is globally unique, so we should check it first
    let normalizedDomain = null;
    if (website) {
      try {
        const url = new URL(website.startsWith('http') ? website : `https://${website}`);
        normalizedDomain = url.hostname.toLowerCase().replace(/^www\./, '').trim();
      } catch (e) {
        // If URL parsing fails, try to extract domain manually
        const domainMatch = website.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
        if (domainMatch) {
          normalizedDomain = domainMatch[1].toLowerCase().replace(/^www\./, '').trim();
        }
      }
    }

    let company = null;

    // STEP 1: Check for domain first (domain is globally unique, so use findUnique)
    if (normalizedDomain) {
      try {
        company = await prisma.companies.findUnique({
          where: { domain: normalizedDomain },
        });
        
        if (company) {
          // Domain exists - check if it's in the same tenant
          if (company.companyHQId !== companyHQId) {
            // Domain exists in a different tenant - this is a conflict
            return NextResponse.json(
              {
                success: false,
                error: `Company with domain ${normalizedDomain} already exists in another tenant`,
                details: 'Domain is globally unique across all tenants',
              },
              { status: 409 }, // Conflict
            );
          }
          console.log(`✅ Found existing company by domain: ${normalizedDomain} (id: ${company.id})`);
        }
      } catch (error) {
        // findUnique throws if not found, but we want to continue searching
        if (error.code !== 'P2025') {
          throw error;
        }
      }
    }

    // STEP 2: If not found by domain, search by companyName within tenant
    if (!company) {
      // First try exact match (fastest)
      company = await prisma.companies.findFirst({
        where: {
          companyHQId,
          companyName: normalizedCompanyName,
        },
      });

      // If not found, try case-insensitive match
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
    }

    if (company) {
      // Update existing company if additional data provided
      const updateData = {};
      if (address !== undefined) updateData.address = address;
      if (industry !== undefined) updateData.industry = industry;
      if (website !== undefined) updateData.website = website;
      if (revenue !== undefined) updateData.revenue = revenue;
      if (yearsInBusiness !== undefined) updateData.yearsInBusiness = yearsInBusiness;
      
      // Update domain if we extracted one and it's not already set
      if (normalizedDomain && !company.domain) {
        updateData.domain = normalizedDomain;
      }

      if (Object.keys(updateData).length > 0) {
        company = await prisma.companies.update({
          where: { id: company.id },
          data: updateData,
        });
      }
      console.log(`✅ Found existing company: ${company.companyName} (id: ${company.id})`);
    } else {
      // Create new company - check domain uniqueness first
      // Double-check domain doesn't exist (race condition protection)
      if (normalizedDomain) {
        try {
          const existingByDomain = await prisma.companies.findUnique({
            where: { domain: normalizedDomain },
          });
          if (existingByDomain) {
            if (existingByDomain.companyHQId !== companyHQId) {
              return NextResponse.json(
                {
                  success: false,
                  error: `Company with domain ${normalizedDomain} already exists in another tenant`,
                  details: 'Domain is globally unique across all tenants',
                },
                { status: 409 },
              );
            }
            // Domain exists in same tenant - use that company
            company = existingByDomain;
            console.log(`✅ Found existing company by domain during create: ${normalizedDomain} (id: ${company.id})`);
          }
        } catch (error) {
          // findUnique throws if not found, which is fine - we can create
          if (error.code !== 'P2025') {
            throw error;
          }
        }
      }

      if (!company) {
        // Create new company
        try {
          // Generate UUID for company ID
          const companyId = randomUUID();
          
          company = await prisma.companies.create({
            data: {
              id: companyId,
              companyHQId,
              companyName: normalizedCompanyName,
              address: address || null,
              industry: industry || null,
              website: website || null,
              domain: normalizedDomain || null, // Set domain if we extracted it
              revenue: revenue || null,
              yearsInBusiness: yearsInBusiness || null,
              updatedAt: new Date(),
            },
          });
          console.log(`✅ Created new company: ${normalizedCompanyName} (id: ${company.id})`);
        } catch (createError) {
          console.error('❌ Create company error:', createError);
          // If it's a unique constraint error (domain or other), try to find the existing one
          if (createError.code === 'P2002') {
            console.log('⚠️ Unique constraint violation, searching for existing company...');
            
            // Check if it's a domain constraint violation
            if (normalizedDomain && createError.meta?.target?.includes('domain')) {
              try {
                company = await prisma.companies.findUnique({
                  where: { domain: normalizedDomain },
                });
                if (company) {
                  console.log(`✅ Found existing company by domain after error: ${normalizedDomain} (id: ${company.id})`);
                }
              } catch (findError) {
                // Continue to name-based search
              }
            }
            
            // If still not found, try name-based search
            if (!company) {
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
                console.log(`✅ Found existing company by name after error: ${company.companyName} (id: ${company.id})`);
              }
            }
            
            if (!company) {
              // Re-throw with better error message
              return NextResponse.json(
                {
                  success: false,
                  error: 'Failed to create company - unique constraint violation',
                  details: createError.message,
                  meta: createError.meta,
                },
                { status: 409 },
              );
            }
          } else {
            // Re-throw other errors
            throw createError;
          }
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

