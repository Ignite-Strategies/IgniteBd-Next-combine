import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getEnrichedContactByKey } from '@/lib/redis';
import { normalizeContactApollo } from '@/lib/enrichment/normalizeContactApollo';
import { normalizeCompanyApollo } from '@/lib/enrichment/normalizeCompanyApollo';
import {
  extractSeniorityScore,
  extractBuyingPowerScore,
  extractUrgencyScore,
  extractRolePowerScore,
  extractCareerMomentumScore,
  extractCareerStabilityScore,
  extractBuyerLikelihoodScore,
  extractReadinessToBuyScore,
  extractCompanyIntelligenceScores,
  type ApolloEnrichmentPayload,
} from '@/lib/intelligence/EnrichmentParserService';

/**
 * POST /api/contacts/enrich/save
 * 
 * Save enriched contact data to database
 * 
 * Body:
 * {
 *   "contactId": "xxxx", // Required - existing contact ID
 *   "redisKey": "apollo:contact:123:timestamp", // Required - Redis key from enrichment
 *   "companyId": "optional" // Optional - existing company ID to link
 * }
 */
export async function POST(request: Request) {
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
    const { contactId, redisKey, companyId } = body;

    // Validate inputs
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    if (!redisKey) {
      return NextResponse.json(
        { success: false, error: 'redisKey is required' },
        { status: 400 },
      );
    }

    // Get existing contact
    const existingContact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!existingContact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Get raw enrichment data from Redis
    const redisData = await getEnrichedContactByKey(redisKey);
    if (!redisData || !redisData.rawEnrichmentPayload) {
      return NextResponse.json(
        { success: false, error: 'Enrichment data not found in Redis' },
        { status: 404 },
      );
    }

    const rawApolloResponse = redisData.rawEnrichmentPayload;

    // Normalize contact fields
    const normalizedContact = normalizeContactApollo(rawApolloResponse);

    // Normalize company fields
    const normalizedCompany = normalizeCompanyApollo(rawApolloResponse);

    // Compute all intelligence scores
    const apolloPayload = rawApolloResponse as ApolloEnrichmentPayload;
    
    const intelligenceScores = {
      seniorityScore: extractSeniorityScore(apolloPayload),
      buyingPowerScore: extractBuyingPowerScore(apolloPayload),
      urgencyScore: extractUrgencyScore(apolloPayload),
      rolePowerScore: extractRolePowerScore(apolloPayload),
      buyerLikelihoodScore: extractBuyerLikelihoodScore(apolloPayload),
      readinessToBuyScore: extractReadinessToBuyScore(apolloPayload),
      careerMomentumScore: extractCareerMomentumScore(apolloPayload),
      careerStabilityScore: extractCareerStabilityScore(apolloPayload),
    };

    const companyIntelligence = extractCompanyIntelligenceScores(apolloPayload);

    // Find or create Company by domain (universal company record)
    let finalCompanyId = companyId || null;
    
    if (normalizedCompany.domain) {
      // Try to find existing company by domain
      const existingCompany = await prisma.company.findFirst({
        where: {
          domain: normalizedCompany.domain,
          companyHQId: existingContact.crmId, // Same tenant
        },
      });

      if (existingCompany) {
        finalCompanyId = existingCompany.id;
        
        // Update company with normalized fields and intelligence
        await prisma.company.update({
          where: { id: existingCompany.id },
          data: {
            companyName: normalizedCompany.companyName || existingCompany.companyName,
            website: normalizedCompany.website || existingCompany.website,
            industry: normalizedCompany.industry || existingCompany.industry,
            headcount: normalizedCompany.headcount ?? existingCompany.headcount,
            revenue: normalizedCompany.revenue ?? existingCompany.revenue,
            revenueRange: normalizedCompany.revenueRange || existingCompany.revenueRange,
            growthRate: normalizedCompany.growthRate ?? existingCompany.growthRate,
            fundingStage: normalizedCompany.fundingStage || existingCompany.fundingStage,
            lastFundingDate: normalizedCompany.lastFundingDate || existingCompany.lastFundingDate,
            lastFundingAmount: normalizedCompany.lastFundingAmount ?? existingCompany.lastFundingAmount,
            numberOfFundingRounds: normalizedCompany.numberOfFundingRounds ?? existingCompany.numberOfFundingRounds,
            companyHealthScore: companyIntelligence.companyHealthScore,
            growthScore: companyIntelligence.growthScore,
            stabilityScore: companyIntelligence.stabilityScore,
            marketPositionScore: companyIntelligence.marketPositionScore,
            readinessScore: companyIntelligence.readinessScore,
          },
        });
      } else {
        // Create new company
        const newCompany = await prisma.company.create({
          data: {
            companyHQId: existingContact.crmId,
            companyName: normalizedCompany.companyName || 'Unknown Company',
            domain: normalizedCompany.domain,
            website: normalizedCompany.website,
            industry: normalizedCompany.industry,
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
          },
        });
        finalCompanyId = newCompany.id;
      }
    }

    // Update contact with normalized fields and intelligence scores
    const contactUpdateData: any = {
      // Enrichment metadata
      enrichmentSource: 'Apollo',
      enrichmentFetchedAt: new Date(),
      enrichmentRedisKey: redisKey,
      
      // Intelligence scores
      ...intelligenceScores,
      
      // Normalized contact fields
      title: normalizedContact.title,
      seniority: normalizedContact.seniority,
      department: normalizedContact.department,
      jobRole: normalizedContact.jobRole,
      linkedinUrl: normalizedContact.linkedinUrl,
      city: normalizedContact.city,
      state: normalizedContact.state,
      country: normalizedContact.country,
      timezone: normalizedContact.timezone,
      
      // Career signals
      currentRoleStartDate: normalizedContact.currentRoleStartDate,
      totalYearsExperience: normalizedContact.totalYearsExperience,
      numberOfJobChanges: normalizedContact.numberOfJobChanges,
      averageTenureMonths: normalizedContact.averageTenureMonths,
      careerProgression: normalizedContact.careerProgression,
      recentJobChange: normalizedContact.recentJobChange,
      recentPromotion: normalizedContact.recentPromotion,
      
      // Company context (convenience copies)
      companyName: normalizedContact.companyName,
      companyDomain: normalizedContact.companyDomain,
      companySize: normalizedContact.companySize,
      companyIndustry: normalizedContact.companyIndustry,
      
      // Universal company relation
      companyId: finalCompanyId,
    };

    // Only update fields that have values
    Object.keys(contactUpdateData).forEach(key => {
      if (contactUpdateData[key] === undefined) {
        delete contactUpdateData[key];
      }
    });

    // Update email if provided
    if (normalizedContact.email && normalizedContact.email !== existingContact.email) {
      contactUpdateData.email = normalizedContact.email.toLowerCase().trim();
    }

    // Update phone if provided
    if (normalizedContact.phone !== undefined) {
      contactUpdateData.phone = normalizedContact.phone;
    }

    // Update name fields if provided
    if (normalizedContact.fullName) contactUpdateData.fullName = normalizedContact.fullName;
    if (normalizedContact.firstName) contactUpdateData.firstName = normalizedContact.firstName;
    if (normalizedContact.lastName) contactUpdateData.lastName = normalizedContact.lastName;

    // Update domain if we have company domain
    if (normalizedContact.companyDomain && !contactUpdateData.domain) {
      contactUpdateData.domain = normalizedContact.companyDomain;
    } else if (normalizedContact.email && normalizedContact.email.includes('@') && !contactUpdateData.domain && !existingContact.domain) {
      const emailDomain = normalizedContact.email.split('@')[1];
      if (emailDomain) {
        contactUpdateData.domain = emailDomain.toLowerCase();
      }
    }

    // Save contact
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: contactUpdateData,
      include: {
        company: true,
        contactCompany: true, // Legacy relation for backward compatibility
        contactList: true,
        pipeline: true,
      },
    });

    return NextResponse.json({
      success: true,
      contact: updatedContact,
      intelligenceScores,
      companyIntelligence,
    });
  } catch (error: any) {
    console.error('❌ Save enrichment error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save enrichment',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

