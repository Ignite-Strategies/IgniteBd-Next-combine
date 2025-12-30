import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { searchCompanyByDomain } from '@/lib/apollo';
import { normalizeCompanyApollo } from '@/lib/enrichment/normalizeCompanyApollo';
import {
  extractCompanyIntelligenceScores,
  enrichCompanyPositioning,
  type ApolloEnrichmentPayload,
} from '@/lib/intelligence/EnrichmentParserService';
import { resolveMembership } from '@/lib/membership';

/**
 * POST /api/companies/enrich
 * 
 * Enrich a company by domain/website using Apollo
 * 
 * Body:
 * {
 *   "companyId": "xxxx", // Required - existing company ID
 *   "domain": "example.com" (optional if website provided)
 *   "website": "https://example.com" (optional if domain provided)
 * }
 * 
 * Returns: Enriched company data with intelligence scores
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
    const { companyId, domain, website } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
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

    // Get existing company
    const existingCompany = await prisma.companies.findUnique({
      where: { id: companyId },
    });

    if (!existingCompany) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    // Membership guard
    const { membership } = await resolveMembership(owner.id, existingCompany.companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 },
      );
    }

    // Determine domain to search
    let searchDomain = domain;
    if (!searchDomain && website) {
      // Extract domain from website URL
      try {
        const url = new URL(website);
        searchDomain = url.hostname.replace(/^www\./, '');
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid website URL' },
          { status: 400 },
        );
      }
    } else if (!searchDomain && existingCompany.domain) {
      searchDomain = existingCompany.domain;
    } else if (!searchDomain && existingCompany.website) {
      try {
        const url = new URL(existingCompany.website);
        searchDomain = url.hostname.replace(/^www\./, '');
      } catch {
        // Invalid URL, continue without domain
      }
    }

    if (!searchDomain) {
      return NextResponse.json(
        { success: false, error: 'Domain or website is required for enrichment' },
        { status: 400 },
      );
    }

    // Enrich company using Apollo
    let apolloResponse: any;
    try {
      apolloResponse = await searchCompanyByDomain(searchDomain);
      console.log('✅ Apollo company search successful for domain:', searchDomain);
    } catch (error: any) {
      console.error('❌ Apollo company search error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Enrichment failed',
          details: error.message || 'Failed to enrich company from Apollo',
        },
        { status: 500 },
      );
    }

    // Apollo organization search returns { organizations: [...] }
    // We need to extract the first organization and structure it like person.organization
    const organizations = (apolloResponse as any).organizations || [];
    if (organizations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No company found in Apollo for this domain' },
        { status: 404 },
      );
    }

    const orgData = organizations[0];
    
    // Structure the Apollo response to match ApolloPersonMatchResponse format
    // normalizeCompanyApollo expects ApolloPersonMatchResponse with person.organization
    // This structure includes website_url and primary_domain which are needed for normalization
    const structuredResponse = {
      person: {
        organization: {
          name: orgData.name || orgData.company_name,
          website_url: orgData.website_url || orgData.website || (orgData.primary_domain ? `https://${orgData.primary_domain}` : undefined),
          primary_domain: orgData.primary_domain || orgData.domain || searchDomain,
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

    // Normalize company fields (expects ApolloPersonMatchResponse which has website_url/primary_domain)
    const normalizedCompany = normalizeCompanyApollo(structuredResponse as any);

    // Extract company intelligence scores (expects ApolloEnrichmentPayload which doesn't need website_url/primary_domain)
    // We can safely cast because extractCompanyIntelligenceScores only uses the fields that exist in ApolloEnrichmentPayload
    const companyIntelligence = extractCompanyIntelligenceScores(structuredResponse as ApolloEnrichmentPayload);

    // Enrich company positioning (GPT + deterministic tiers)
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
        companyName: normalizedCompany.companyName || existingCompany.companyName,
        industry: normalizedCompany.industry || existingCompany.industry,
        revenue: normalizedCompany.revenue || existingCompany.revenue,
        headcount: normalizedCompany.headcount || existingCompany.headcount,
      });
    } catch (error) {
      console.error('Error enriching company positioning:', error);
      // Continue without positioning data
    }

    // Update company with enrichment data
    const updatedCompany = await prisma.companies.update({
      where: { id: companyId },
      data: {
        // Basic company info (enrichment data takes precedence if available)
        companyName: normalizedCompany.companyName || existingCompany.companyName,
        website: normalizedCompany.website || existingCompany.website,
        industry: normalizedCompany.industry || existingCompany.industry,
        domain: normalizedCompany.domain || existingCompany.domain || searchDomain,

        // Company size/financials (enrichment data takes precedence)
        headcount: normalizedCompany.headcount ?? existingCompany.headcount,
        revenue: normalizedCompany.revenue ?? existingCompany.revenue,
        revenueRange: normalizedCompany.revenueRange || existingCompany.revenueRange,
        growthRate: normalizedCompany.growthRate ?? existingCompany.growthRate,

        // Funding info (enrichment data takes precedence)
        fundingStage: normalizedCompany.fundingStage || existingCompany.fundingStage,
        lastFundingDate: normalizedCompany.lastFundingDate || existingCompany.lastFundingDate,
        lastFundingAmount: normalizedCompany.lastFundingAmount ?? existingCompany.lastFundingAmount,
        numberOfFundingRounds: normalizedCompany.numberOfFundingRounds ?? existingCompany.numberOfFundingRounds,

        // Company Intelligence Scores
        companyHealthScore: companyIntelligence.companyHealthScore ?? existingCompany.companyHealthScore,
        growthScore: companyIntelligence.growthScore ?? existingCompany.growthScore,
        stabilityScore: companyIntelligence.stabilityScore ?? existingCompany.stabilityScore,
        marketPositionScore: companyIntelligence.marketPositionScore ?? existingCompany.marketPositionScore,
        readinessScore: companyIntelligence.readinessScore ?? existingCompany.readinessScore,

        // Inference layer fields
        positioningLabel: companyPositioning.positioningLabel || existingCompany.positioningLabel,
        category: companyPositioning.category || existingCompany.category,
        revenueTier: companyPositioning.revenueTier || existingCompany.revenueTier,
        headcountTier: companyPositioning.headcountTier || existingCompany.headcountTier,
        normalizedIndustry: companyPositioning.normalizedIndustry || existingCompany.normalizedIndustry,
        competitors: companyPositioning.competitors?.length ? companyPositioning.competitors : existingCompany.competitors,

        updatedAt: new Date(),
      },
    });

    console.log(`✅ Company ${companyId} enriched successfully`);

    return NextResponse.json({
      success: true,
      company: updatedCompany,
      enrichment: {
        normalizedCompany,
        companyIntelligence,
        companyPositioning,
      },
    });
  } catch (error: any) {
    console.error('❌ Company enrichment error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to enrich company',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

