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
    
    // Log what we're receiving
    console.log('📥 Enrich save request received:', {
      contactId: body.contactId,
      hasRedisKey: !!body.redisKey,
      hasRawEnrichmentPayload: !!body.rawEnrichmentPayload,
      skipIntelligence: body.skipIntelligence,
      hasCompanyHQId: !!body.companyHQId,
      hasProfileSummary: !!body.profileSummary,
      hasTenureYears: body.tenureYears !== undefined,
      hasCurrentTenureYears: body.currentTenureYears !== undefined,
      hasTotalExperienceYears: body.totalExperienceYears !== undefined,
      hasAvgTenureYears: body.avgTenureYears !== undefined,
      hasCareerTimeline: !!body.careerTimeline,
      hasCompanyPositioning: !!body.companyPositioning,
      rawPayloadKeys: body.rawEnrichmentPayload ? Object.keys(body.rawEnrichmentPayload) : [],
    });
    
    const { 
      contactId, 
      redisKey, 
      rawEnrichmentPayload, // Accept payload directly (alternative to redisKey)
      companyId, 
      previewId, 
      skipIntelligence, 
      companyHQId,
      // Also accept inference fields directly if available
      profileSummary,
      tenureYears,
      currentTenureYears,
      totalExperienceYears,
      avgTenureYears,
      careerTimeline,
      companyPositioning,
    } = body;

    // Validate inputs
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    // Either redisKey OR rawEnrichmentPayload must be provided
    if (!redisKey && !rawEnrichmentPayload) {
      return NextResponse.json(
        { success: false, error: 'Either redisKey or rawEnrichmentPayload is required' },
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
    // If not provided, use contact's crmId
    const targetCompanyHQId = companyHQId || existingContact.crmId;
    
    // CRITICAL: Verify user has membership in this CompanyHQ
    if (targetCompanyHQId) {
      const owner = await prisma.owners.findUnique({
        where: { firebaseId: firebaseUser.uid },
        select: { id: true },
      });

      if (owner) {
        const { resolveMembership } = await import('@/lib/membership');
        const { membership } = await resolveMembership(owner.id, targetCompanyHQId);
        
        if (!membership) {
          console.error(`❌ ACCESS DENIED: Owner ${owner.id} attempted to enrich contact in CompanyHQ ${targetCompanyHQId} without membership`);
          return NextResponse.json(
            {
              success: false,
              error: 'Forbidden: No membership in this CompanyHQ. Please switch to a CompanyHQ you have access to.',
              details: {
                requestedCompanyHQId: targetCompanyHQId,
                contactCrmId: existingContact.crmId,
                ownerId: owner.id,
              },
            },
            { status: 403 },
          );
        }
        console.log(`✅ Membership verified: Owner ${owner.id} has ${membership.role} role in CompanyHQ ${targetCompanyHQId}`);
      }
    }
    
    // CANON: Contacts are CompanyHQ-scoped - enrichment only updates contacts in this CompanyHQ
    // Verify contact belongs to the CompanyHQ that's enriching it
    if (targetCompanyHQId && existingContact.crmId !== targetCompanyHQId) {
      console.error(`❌ CANON VIOLATION: Contact ${contactId} belongs to CompanyHQ ${existingContact.crmId} but enrich request is for CompanyHQ ${targetCompanyHQId}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Contact does not belong to this CompanyHQ. Each CompanyHQ has its own contact records.',
          details: {
            contactId,
            contactCrmId: existingContact.crmId,
            requestedCompanyHQId: targetCompanyHQId,
          },
        },
        { status: 403 },
      );
    }

    // Get raw enrichment data - either from request body or Redis
    let rawApolloResponse: any;
    
    if (rawEnrichmentPayload) {
      // Use payload directly from request body (no Redis needed!)
      console.log('✅ Using enrichment payload from request body (skipping Redis)');
      rawApolloResponse = rawEnrichmentPayload;
    } else if (redisKey) {
      // Fallback to Redis if no direct payload provided
      let redisData;
      try {
        redisData = await getEnrichedContactByKey(redisKey);
      } catch (redisError: any) {
        console.error('❌ Redis connection error:', redisError);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Redis connection failed. Please check Redis configuration or pass rawEnrichmentPayload directly.',
            details: process.env.NODE_ENV === 'development' ? redisError.message : undefined,
          },
          { status: 503 },
        );
      }
      
      if (!redisData) {
        return NextResponse.json(
          { success: false, error: 'Enrichment data not found in Redis. The data may have expired or the Redis key is invalid.' },
          { status: 404 },
        );
      }

      // Handle different Redis data formats
      // Format 1: { rawEnrichmentPayload: ... } (from generate-intel route)
      // Format 2: { enrichedData: { rawApolloResponse: ... } } (from enrich route)
      if (redisData.rawEnrichmentPayload) {
        rawApolloResponse = redisData.rawEnrichmentPayload;
      } else if (redisData.enrichedData?.rawApolloResponse) {
        rawApolloResponse = redisData.enrichedData.rawApolloResponse;
      } else if (redisData.rawApolloResponse) {
        // Direct format
        rawApolloResponse = redisData.rawApolloResponse;
      } else {
        console.error('❌ Invalid Redis data format:', {
          redisKey,
          redisDataKeys: Object.keys(redisData),
          hasRawEnrichmentPayload: !!redisData.rawEnrichmentPayload,
          hasEnrichedData: !!redisData.enrichedData,
          hasRawApolloResponse: !!redisData.rawApolloResponse,
        });
        return NextResponse.json(
          { success: false, error: 'Invalid enrichment data format in Redis' },
          { status: 400 },
        );
      }
      
      console.log('✅ Retrieved rawEnrichmentPayload from Redis:', {
        redisKey,
        hasPerson: !!rawApolloResponse?.person,
        hasEmploymentHistory: !!rawApolloResponse?.person?.employment_history,
        employmentHistoryLength: rawApolloResponse?.person?.employment_history?.length || 0,
      });
    }
    
    // CRITICAL: rawEnrichmentPayload should ALWAYS be present at this point
    if (!rawApolloResponse) {
      console.error('❌ CRITICAL: rawEnrichmentPayload is missing after retrieval!');
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve enrichment payload. Please try enriching again.' },
        { status: 500 },
      );
    }

    // Get inference fields - use from request body if provided, otherwise try Redis previewId
    let finalProfileSummary: string | null = profileSummary || null;
    let finalTenureYears: number | null = tenureYears ?? null;
    let finalCurrentTenureYears: number | null = currentTenureYears ?? null;
    let finalTotalExperienceYears: number | null = totalExperienceYears ?? null;
    let finalAvgTenureYears: number | null = avgTenureYears ?? null;
    let finalCareerTimeline: any = careerTimeline || null;
    let finalCompanyPositioning: {
      positioningLabel?: string;
      category?: string;
      revenueTier?: string;
      headcountTier?: string;
      normalizedIndustry?: string;
      competitors?: string[];
    } = companyPositioning || {};

    // If inference fields not provided in request body, try to fetch from Redis (if previewId provided)
    if (previewId && !skipIntelligence && !finalProfileSummary) {
      try {
        const previewData = await getPreviewIntelligence(previewId);
        if (previewData) {
          finalProfileSummary = previewData.profileSummary || null;
          finalTenureYears = previewData.tenureYears ?? null;
          finalCurrentTenureYears = previewData.currentTenureYears ?? null;
          finalTotalExperienceYears = previewData.totalExperienceYears ?? null;
          finalAvgTenureYears = previewData.avgTenureYears ?? null;
          finalCareerTimeline = previewData.careerTimeline || null;
          finalCompanyPositioning = previewData.companyPositioning || {};
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
    
    console.log('🔍 Enrichment save debug:', {
      skipIntelligence,
      hasApolloPayload: !!apolloPayload,
      hasPerson: !!apolloPayload.person,
    });
    
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
    
    console.log('📊 Intelligence scores computed:', {
      skipIntelligence,
      scores: intelligenceScores,
      hasScores: Object.values(intelligenceScores).some(v => v !== null && v !== undefined),
    });

    const companyIntelligence = skipIntelligence 
      ? null 
      : extractCompanyIntelligenceScores(apolloPayload);

    // ============================================
    // STEP 1: Update Contact with all enrichment data
    // ============================================
    // CRITICAL: Store rawEnrichmentPayload in database for future reference
    // This should ALWAYS be present regardless of Redis
    const enrichmentPayloadJson = rawApolloResponse ? JSON.stringify(rawApolloResponse) : null;
    
    // Generate a redisKey if we have rawEnrichmentPayload but no redisKey
    // This allows us to track enrichment even when bypassing Redis
    const finalRedisKey = redisKey || (rawEnrichmentPayload ? `apollo:contact:${contactId}:${Date.now()}` : null);
    
    const contactUpdateData: any = {
      // Enrichment metadata
      enrichmentSource: 'Apollo',
      enrichmentFetchedAt: new Date(),
      enrichmentPayload: enrichmentPayloadJson, // ALWAYS store raw payload in database
      ...(finalRedisKey ? { enrichmentRedisKey: finalRedisKey } : {}),
      
      // Intelligence scores (only if not skipping)
      // Include scores even if they're null - this indicates we tried to compute them
      ...(skipIntelligence ? {} : {
        seniorityScore: intelligenceScores.seniorityScore ?? null,
        buyingPowerScore: intelligenceScores.buyingPowerScore ?? null,
        urgencyScore: intelligenceScores.urgencyScore ?? null,
        rolePowerScore: intelligenceScores.rolePowerScore ?? null,
        buyerLikelihoodScore: intelligenceScores.buyerLikelihoodScore ?? null,
        readinessToBuyScore: intelligenceScores.readinessToBuyScore ?? null,
        careerMomentumScore: intelligenceScores.careerMomentumScore ?? null,
        careerStabilityScore: intelligenceScores.careerStabilityScore ?? null,
      }),
      
      // Inference layer fields (only if not skipping)
      ...(skipIntelligence ? {} : {
        profileSummary: finalProfileSummary || null,
        tenureYears: finalTenureYears ?? null,
        currentTenureYears: finalCurrentTenureYears ?? null,
        totalExperienceYears: finalTotalExperienceYears ?? null,
        avgTenureYears: finalAvgTenureYears ?? null,
        careerTimeline: finalCareerTimeline || null,
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

    // Only update fields that have values (but preserve null values for explicit fields)
    // Don't delete intelligence scores if they're null - they might be legitimately null
    Object.keys(contactUpdateData).forEach(key => {
      if (contactUpdateData[key] === undefined) {
        delete contactUpdateData[key];
      }
    });
    
    // Log what we're about to save
    console.log('💾 Contact update data:', {
      hasIntelligenceScores: !skipIntelligence && Object.keys(intelligenceScores).length > 0,
      intelligenceScoreKeys: !skipIntelligence ? Object.keys(intelligenceScores) : [],
      hasProfileSummary: !skipIntelligence && !!finalProfileSummary,
      enrichmentRedisKey: finalRedisKey,
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
              positioningLabel: finalCompanyPositioning.positioningLabel || existingCompany.positioningLabel,
              category: finalCompanyPositioning.category || existingCompany.category,
              revenueTier: finalCompanyPositioning.revenueTier || existingCompany.revenueTier,
              headcountTier: finalCompanyPositioning.headcountTier || existingCompany.headcountTier,
              normalizedIndustry: finalCompanyPositioning.normalizedIndustry || existingCompany.normalizedIndustry,
              competitors: finalCompanyPositioning.competitors?.length ? finalCompanyPositioning.competitors : existingCompany.competitors,
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
              positioningLabel: finalCompanyPositioning.positioningLabel || companyByDomain.positioningLabel,
              category: finalCompanyPositioning.category || companyByDomain.category,
              revenueTier: finalCompanyPositioning.revenueTier || companyByDomain.revenueTier,
              headcountTier: finalCompanyPositioning.headcountTier || companyByDomain.headcountTier,
              normalizedIndustry: finalCompanyPositioning.normalizedIndustry || companyByDomain.normalizedIndustry,
              competitors: finalCompanyPositioning.competitors?.length ? finalCompanyPositioning.competitors : companyByDomain.competitors,
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
              positioningLabel: finalCompanyPositioning.positioningLabel,
              category: finalCompanyPositioning.category,
              revenueTier: finalCompanyPositioning.revenueTier,
              headcountTier: finalCompanyPositioning.headcountTier,
              normalizedIndustry: finalCompanyPositioning.normalizedIndustry,
              competitors: finalCompanyPositioning.competitors || [],
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

