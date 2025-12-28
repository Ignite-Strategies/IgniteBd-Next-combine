import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getEnrichedContactByKey, getPreviewIntelligence } from '@/lib/redis';
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
    const { contactId, redisKey, companyId, previewId, skipIntelligence } = body;

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

    // Get existing contact with company relation
    const existingContact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        companies: true, // Get the contact's existing company
      },
    });

    if (!existingContact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Get companyHQId from request body (should match contact's crmId)
    const { companyHQId } = body;
    
    // Validate that contact belongs to the companyHQ being used (if provided)
    if (companyHQId && existingContact.crmId !== companyHQId) {
      console.warn(`⚠️ Contact ${contactId} has crmId ${existingContact.crmId} but enrich request has companyHQId ${companyHQId}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Contact belongs to a different companyHQ and cannot be enriched in this context.',
          details: {
            contactCrmId: existingContact.crmId,
            requestedCompanyHQId: companyHQId,
          },
        },
        { status: 403 },
      );
    }

    // Get raw enrichment data from Redis
    const redisData = await getEnrichedContactByKey(redisKey);
    if (!redisData) {
      return NextResponse.json(
        { success: false, error: 'Enrichment data not found in Redis' },
        { status: 404 },
      );
    }

    // Handle different Redis data formats
    // Format 1: { rawEnrichmentPayload: ... } (from generate-intel route)
    // Format 2: { enrichedData: { rawApolloResponse: ... } } (from enrich route)
    let rawApolloResponse: any;
    if (redisData.rawEnrichmentPayload) {
      rawApolloResponse = redisData.rawEnrichmentPayload;
    } else if (redisData.enrichedData?.rawApolloResponse) {
      rawApolloResponse = redisData.enrichedData.rawApolloResponse;
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid enrichment data format in Redis' },
        { status: 400 },
      );
    }

    // Get inference fields from preview data (if previewId provided and not skipping intelligence)
    let profileSummary: string | null = null;
    let tenureYears: number | null = null;
    let currentTenureYears: number | null = null;
    let totalExperienceYears: number | null = null;
    let avgTenureYears: number | null = null;
    let careerTimeline: any = null;
    let companyPositioning: {
      positioningLabel?: string;
      category?: string;
      revenueTier?: string;
      headcountTier?: string;
      normalizedIndustry?: string;
      competitors?: string[];
    } = {};

    if (previewId && !skipIntelligence) {
      try {
        const previewData = await getPreviewIntelligence(previewId);
        if (previewData) {
          profileSummary = previewData.profileSummary || null;
          tenureYears = previewData.tenureYears || null;
          currentTenureYears = previewData.currentTenureYears || null;
          totalExperienceYears = previewData.totalExperienceYears || null;
          avgTenureYears = previewData.avgTenureYears || null;
          careerTimeline = previewData.careerTimeline || null;
          companyPositioning = previewData.companyPositioning || {};
        }
      } catch (error: any) {
        console.warn('⚠️ Could not fetch preview data for inferences (non-critical):', error.message);
      }
    }

    // Normalize contact fields
    const normalizedContact = normalizeContactApollo(rawApolloResponse);

    // Normalize company fields
    const normalizedCompany = normalizeCompanyApollo(rawApolloResponse);

    // Compute intelligence scores (skip if skipIntelligence is true)
    const apolloPayload = rawApolloResponse as ApolloEnrichmentPayload;
    
    const intelligenceScores = skipIntelligence ? {} : {
      seniorityScore: extractSeniorityScore(apolloPayload),
      buyingPowerScore: extractBuyingPowerScore(apolloPayload),
      urgencyScore: extractUrgencyScore(apolloPayload),
      rolePowerScore: extractRolePowerScore(apolloPayload),
      buyerLikelihoodScore: extractBuyerLikelihoodScore(apolloPayload),
      readinessToBuyScore: extractReadinessToBuyScore(apolloPayload),
      careerMomentumScore: extractCareerMomentumScore(apolloPayload),
      careerStabilityScore: extractCareerStabilityScore(apolloPayload),
    };

    const companyIntelligence = skipIntelligence 
      ? null 
      : extractCompanyIntelligenceScores(apolloPayload);

    // ============================================
    // STEP 1: Update Contact with all enrichment data
    // ============================================
    const contactUpdateData: any = {
      // Enrichment metadata
      enrichmentSource: 'Apollo',
      enrichmentFetchedAt: new Date(),
      enrichmentRedisKey: redisKey,
      
      // Intelligence scores (only if not skipping)
      ...(skipIntelligence ? {} : intelligenceScores),
      
      // Inference layer fields (only if not skipping)
      ...(skipIntelligence ? {} : {
        profileSummary: profileSummary || undefined,
        tenureYears: tenureYears || undefined, // Keep for backward compatibility
        currentTenureYears: currentTenureYears || undefined,
        totalExperienceYears: totalExperienceYears || undefined,
        avgTenureYears: avgTenureYears || undefined,
        careerTimeline: careerTimeline || undefined,
      }),
      
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
      
      // Don't set contactCompanyId here - we'll handle that in STEP 2 after finding/creating company
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

    // STEP 1: Save contact with all enrichment data
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: contactUpdateData,
      include: {
        companies: true,
        contact_lists: true,
        pipelines: true,
      },
    });
    console.log(`✅ STEP 1: Updated contact ${contactId} with enrichment data`);

    // ============================================
    // STEP 2: Update Company with enrichment data (if exists)
    // ============================================
    // Use contactCompanyId (FK) as primary, fallback to companyId param or enrichment companyId field
    let finalCompanyId = companyId || updatedContact.contactCompanyId || updatedContact.companyId || null;
    
    // If contact has a company, update it with enrichment data
    if (finalCompanyId) {
      const existingCompany = await prisma.companies.findUnique({
        where: { id: finalCompanyId },
      });
      
      if (existingCompany) {
        // STEP 2: Update existing company with all enrichment data
        await prisma.companies.update({
          where: { id: existingCompany.id },
          data: {
            // Basic company info (enrichment data takes precedence if available)
            companyName: normalizedCompany.companyName || existingCompany.companyName,
            website: normalizedCompany.website || existingCompany.website,
            industry: normalizedCompany.industry || existingCompany.industry,
            domain: normalizedCompany.domain || existingCompany.domain,
            
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
            
            // Company Intelligence Scores (from enrichment, only if not skipping)
            ...(companyIntelligence ? {
              companyHealthScore: companyIntelligence.companyHealthScore ?? existingCompany.companyHealthScore,
              growthScore: companyIntelligence.growthScore ?? existingCompany.growthScore,
              stabilityScore: companyIntelligence.stabilityScore ?? existingCompany.stabilityScore,
              marketPositionScore: companyIntelligence.marketPositionScore ?? existingCompany.marketPositionScore,
              readinessScore: companyIntelligence.readinessScore ?? existingCompany.readinessScore,
            } : {}),
            
            // Inference layer fields (enrichment data takes precedence, only if not skipping)
            ...(skipIntelligence ? {} : {
              positioningLabel: companyPositioning.positioningLabel || existingCompany.positioningLabel,
              category: companyPositioning.category || existingCompany.category,
              revenueTier: companyPositioning.revenueTier || existingCompany.revenueTier,
              headcountTier: companyPositioning.headcountTier || existingCompany.headcountTier,
              normalizedIndustry: companyPositioning.normalizedIndustry || existingCompany.normalizedIndustry,
              competitors: companyPositioning.competitors?.length ? companyPositioning.competitors : existingCompany.competitors,
            }),
            
            updatedAt: new Date(),
          },
        });
        console.log(`✅ STEP 2: Enriched existing company ${existingCompany.id} with enrichment data`);
      }
    } else if (normalizedCompany.domain) {
      // No existing company - try to find by domain (domain is globally unique)
      const companyByDomain = await prisma.companies.findUnique({
        where: {
          domain: normalizedCompany.domain,
        },
      });
      
      if (companyByDomain) {
        // Found company by domain - link it and update with enrichment data
        finalCompanyId = companyByDomain.id;
        
        // Update contact to link to this company (ONLY set contactCompanyId - the FK)
        await prisma.contact.update({
          where: { id: contactId },
          data: {
            contactCompanyId: companyByDomain.id, // Only set the FK, not companyId (enrichment field)
          },
        });
        
        // Update company with enrichment data
        await prisma.companies.update({
          where: { id: companyByDomain.id },
          data: {
            companyName: normalizedCompany.companyName || companyByDomain.companyName,
            website: normalizedCompany.website || companyByDomain.website,
            industry: normalizedCompany.industry || companyByDomain.industry,
            headcount: normalizedCompany.headcount ?? companyByDomain.headcount,
            revenue: normalizedCompany.revenue ?? companyByDomain.revenue,
            revenueRange: normalizedCompany.revenueRange || companyByDomain.revenueRange,
            growthRate: normalizedCompany.growthRate ?? companyByDomain.growthRate,
            fundingStage: normalizedCompany.fundingStage || companyByDomain.fundingStage,
            lastFundingDate: normalizedCompany.lastFundingDate || companyByDomain.lastFundingDate,
            lastFundingAmount: normalizedCompany.lastFundingAmount ?? companyByDomain.lastFundingAmount,
            numberOfFundingRounds: normalizedCompany.numberOfFundingRounds ?? companyByDomain.numberOfFundingRounds,
            ...(companyIntelligence ? {
              companyHealthScore: companyIntelligence.companyHealthScore,
              growthScore: companyIntelligence.growthScore,
              stabilityScore: companyIntelligence.stabilityScore,
              marketPositionScore: companyIntelligence.marketPositionScore,
              readinessScore: companyIntelligence.readinessScore,
              positioningLabel: companyPositioning.positioningLabel || companyByDomain.positioningLabel,
              category: companyPositioning.category || companyByDomain.category,
              revenueTier: companyPositioning.revenueTier || companyByDomain.revenueTier,
              headcountTier: companyPositioning.headcountTier || companyByDomain.headcountTier,
              normalizedIndustry: companyPositioning.normalizedIndustry || companyByDomain.normalizedIndustry,
              competitors: companyPositioning.competitors?.length ? companyPositioning.competitors : companyByDomain.competitors,
            } : {}),
            updatedAt: new Date(),
          },
        });
        console.log(`✅ STEP 2: Found company by domain, linked to contact, and enriched: ${companyByDomain.id}`);
      } else {
        // No company found by domain - create new company from enrichment data
        const { randomUUID } = await import('crypto');
        const newCompanyId = randomUUID();
        
        const newCompany = await prisma.companies.create({
          data: {
            id: newCompanyId,
            companyHQId: updatedContact.crmId,
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
            ...(companyIntelligence ? {
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
            } : {}),
            updatedAt: new Date(),
          },
        });
        
        // Link the new company to the contact (ONLY set contactCompanyId - the FK)
        await prisma.contact.update({
          where: { id: contactId },
          data: {
            contactCompanyId: newCompanyId, // Only set the FK, not companyId (enrichment field)
          },
        });
        
        finalCompanyId = newCompanyId;
        console.log(`✅ STEP 2: Created new company from enrichment data and linked to contact: ${newCompanyId}`);
      }
    } else if (normalizedCompany.companyName) {
      // Contact has no company AND no domain, but we have company name from enrichment
      // Create a new company from enrichment data - this is the key: GET THE CONTACT A COMPANY!
      const { randomUUID } = await import('crypto');
      const newCompanyId = randomUUID();
      
      const newCompany = await prisma.companies.create({
        data: {
          id: newCompanyId,
          companyHQId: updatedContact.crmId,
          companyName: normalizedCompany.companyName,
          domain: normalizedCompany.domain || null, // May be null if no domain in enrichment
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
          ...(companyIntelligence ? {
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
          } : {}),
          updatedAt: new Date(),
        },
      });
      
      // Link the new company to the contact
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          companyId: newCompanyId,
          contactCompanyId: newCompanyId,
        },
      });
      
      console.log(`✅ STEP 2: Created new company from enrichment data (no domain) and linked to contact: ${newCompanyId}`);
    } else if (normalizedCompany.companyName) {
      // Contact has no company AND no domain, but we have company name from enrichment
      // Create a new company from enrichment data
      const { randomUUID } = await import('crypto');
      const newCompanyId = randomUUID();
      
      const newCompany = await prisma.companies.create({
        data: {
          id: newCompanyId,
          companyHQId: updatedContact.crmId,
          companyName: normalizedCompany.companyName,
          domain: normalizedCompany.domain || null,
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
          ...(companyIntelligence ? {
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
          } : {}),
          updatedAt: new Date(),
        },
      });
      
      // Link the new company to the contact
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          companyId: newCompanyId,
          contactCompanyId: newCompanyId,
        },
      });
      
      console.log(`✅ STEP 2: Created new company from enrichment data (no domain) and linked to contact: ${newCompanyId}`);
    }

    // Pipeline is NOT part of enrichment - it's a separate concern
    // Don't create/update pipeline during enrichment

    // Re-fetch contact with pipeline to ensure it's included
    const contactWithPipeline = await prisma.contact.findUnique({
      where: { id: updatedContact.id },
      include: {
        companies: true,
        contact_lists: true,
        pipelines: true,
      },
    });

    return NextResponse.json({
      success: true,
      contact: contactWithPipeline,
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

