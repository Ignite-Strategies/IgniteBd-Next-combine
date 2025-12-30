import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';
import { searchCompanyByDomain } from '@/lib/apollo';
import { normalizeCompanyApollo } from '@/lib/enrichment/normalizeCompanyApollo';
import {
  extractCompanyIntelligenceScores,
  enrichCompanyPositioning,
  type ApolloEnrichmentPayload,
} from '@/lib/intelligence/EnrichmentParserService';
import { randomUUID } from 'crypto';

/**
 * POST /api/companies/lookup
 * 
 * Smart company lookup: Check DB first, then Apollo if not found
 * Automatically creates company if enriched from Apollo
 * 
 * Body:
 * {
 *   "query": "company name or website/domain"
 * }
 * 
 * Returns: Company data (from DB or enriched from Apollo)
 */
export async function POST(request: Request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { query } = body;

    if (!query || !query.trim()) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 },
      );
    }

    // Get owner from firebaseId
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Get companyHQId from query or localStorage (we'll need to pass it)
    // For now, get from request header or body
    const companyHQId = body.companyHQId;
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Membership guard
    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 },
      );
    }

    const searchQuery = query.trim();
    
    // Extract domain from query if it looks like a URL
    let domain = null;
    let companyName = searchQuery;
    
    if (searchQuery.includes('://') || searchQuery.includes('.')) {
      try {
        const url = searchQuery.startsWith('http') 
          ? new URL(searchQuery)
          : new URL(`https://${searchQuery}`);
        domain = url.hostname.replace(/^www\./, '').toLowerCase();
        // Try to extract company name from domain (fallback)
        companyName = domain.split('.')[0];
      } catch {
        // Not a valid URL, treat as company name
        domain = null;
      }
    }

    // STEP 1: Check DB first (save API calls!)
    let company = null;

    // Try by domain first (most reliable)
    if (domain) {
      company = await prisma.companies.findUnique({
        where: { domain },
      });
      
      // Verify it's in the same tenant
      if (company && company.companyHQId !== companyHQId) {
        company = null; // Domain exists but in different tenant
      }
    }

    // Try by name if not found by domain
    if (!company) {
      const normalizedName = companyName.toLowerCase().trim();
      
      // Try exact match first
      company = await prisma.companies.findFirst({
        where: {
          companyHQId,
          companyName: {
            equals: companyName,
            mode: 'insensitive',
          },
        },
      });
    }

    // If found in DB, return it
    if (company) {
      return NextResponse.json({
        success: true,
        company,
        source: 'database',
      });
    }

    // STEP 2: Not in DB - try Apollo (only if we have domain or it looks like a domain)
    if (!domain && !searchQuery.includes('.')) {
      // No domain and doesn't look like one - can't enrich
      return NextResponse.json(
        { success: false, error: 'Company not found. Please provide a website/domain to enrich from Apollo.' },
        { status: 404 },
      );
    }

    // Use domain for Apollo search, or try to extract from company name
    const apolloSearchDomain = domain || searchQuery.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    let apolloResponse: any;
    try {
      apolloResponse = await searchCompanyByDomain(apolloSearchDomain);
      console.log('✅ Apollo company search successful for domain:', apolloSearchDomain);
    } catch (error: any) {
      console.error('❌ Apollo company search error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Company not found in database or Apollo',
          details: error.message || 'Failed to enrich company from Apollo',
        },
        { status: 404 },
      );
    }

    // Apollo organization search returns { organizations: [...] }
    const organizations = (apolloResponse as any).organizations || [];
    if (organizations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Company not found in Apollo' },
        { status: 404 },
      );
    }

    const orgData = organizations[0];
    
    // Structure the Apollo response
    const structuredResponse: any = {
      person: {
        organization: {
          name: orgData.name || orgData.company_name || companyName,
          website_url: orgData.website_url || orgData.website || (orgData.primary_domain ? `https://${orgData.primary_domain}` : undefined),
          primary_domain: orgData.primary_domain || orgData.domain || apolloSearchDomain,
          employees: orgData.employees || orgData.estimated_num_employees || orgData.num_employees,
          estimated_num_employees: orgData.estimated_num_employees || orgData.employees || orgData.num_employees,
          annual_revenue: orgData.annual_revenue || orgData.revenue,
          revenue_range: orgData.revenue_range || orgData.revenue_range_text,
          growth_rate: orgData.growth_rate || orgData.growth_percentage,
          industry: orgData.industry || orgData.industry_tag_id,
          funding_events: orgData.funding_events || orgData.funding || [],
        },
      },
    };

    // Normalize company fields
    const normalizedCompany = normalizeCompanyApollo(structuredResponse);

    // Extract company intelligence scores
    const companyIntelligence = extractCompanyIntelligenceScores(structuredResponse as ApolloEnrichmentPayload);

    // Enrich company positioning
    let companyPositioning = {
      positioningLabel: null,
      category: null,
      revenueTier: null,
      headcountTier: null,
      normalizedIndustry: null,
      competitors: [],
    };

    try {
      companyPositioning = await enrichCompanyPositioning({
        companyName: normalizedCompany.companyName || companyName,
        industry: normalizedCompany.industry,
        revenue: normalizedCompany.revenue,
        headcount: normalizedCompany.headcount,
      });
    } catch (error) {
      console.error('Error enriching company positioning:', error);
    }

    // STEP 3: Create company in DB from Apollo data
    const companyId = randomUUID();
    const finalDomain = normalizedCompany.domain || apolloSearchDomain;

    const newCompany = await prisma.companies.create({
      data: {
        id: companyId,
        companyHQId,
        companyName: normalizedCompany.companyName || companyName,
        website: normalizedCompany.website || (finalDomain ? `https://${finalDomain}` : null),
        industry: normalizedCompany.industry,
        domain: finalDomain,
        headcount: normalizedCompany.headcount,
        revenue: normalizedCompany.revenue,
        revenueRange: normalizedCompany.revenueRange,
        growthRate: normalizedCompany.growthRate,
        fundingStage: normalizedCompany.fundingStage,
        lastFundingDate: normalizedCompany.lastFundingDate,
        lastFundingAmount: normalizedCompany.lastFundingAmount,
        numberOfFundingRounds: normalizedCompany.numberOfFundingRounds,
        companyHealthScore: companyIntelligence.companyHealthScore,
        growthScore: companyIntelligence.growthScore,
        stabilityScore: companyIntelligence.stabilityScore,
        marketPositionScore: companyIntelligence.marketPositionScore,
        readinessScore: companyIntelligence.readinessScore,
        positioningLabel: companyPositioning.positioningLabel,
        category: companyPositioning.category,
        revenueTier: companyPositioning.revenueTier,
        headcountTier: companyPositioning.headcountTier,
        normalizedIndustry: companyPositioning.normalizedIndustry,
        competitors: companyPositioning.competitors || [],
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Created company from Apollo: ${newCompany.companyName} (id: ${newCompany.id})`);

    return NextResponse.json({
      success: true,
      company: newCompany,
      source: 'apollo',
    });
  } catch (error: any) {
    console.error('❌ Company lookup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to lookup company',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

