import { NextResponse } from 'next/server';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { enrichPerson, normalizeApolloResponse } from '@/lib/apollo';
import { getRedis } from '@/lib/redis';
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
  generateContactProfileSummary,
  calculateTenureYears,
  calculateCareerStats,
  generateCareerTimeline,
  enrichCompanyPositioning,
  type ApolloEnrichmentPayload,
} from '@/lib/intelligence/EnrichmentParserService';

/**
 * POST /api/contacts/enrich/generate-intel
 * 
 * Generate intelligence scores from enrichment data
 * 
 * Body:
 * {
 *   "linkedinUrl": "https://linkedin.com/in/..." (optional if email provided)
 *   "email": "foo@bar.com" (optional if linkedinUrl provided)
 *   "contactId": "xxxx" (optional - if enriching existing contact)
 * }
 * 
 * Returns:
 * {
 *   "previewId": "preview:abc123",
 *   "normalizedContact": {...},
 *   "normalizedCompany": {...},
 *   "intelligenceScores": {...},
 *   "companyIntelligence": {...},
 *   "redisKey": "apollo:preview:abc123"
 * }
 * 
 * Stores in Redis:
 * - Raw Apollo JSON under redisKey
 * - Normalized data + intelligence scores under previewId
 * 
 * NO database writes - this is preview only
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
    const { linkedinUrl, email, contactId } = body;

    // Validate inputs
    if (!linkedinUrl && !email) {
      return NextResponse.json(
        { success: false, error: 'Either linkedinUrl or email is required' },
        { status: 400 },
      );
    }

    if (email && !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 },
      );
    }

    // Enrich contact using Apollo ENRICHMENT (/people/enrich - deep lookup)
    let rawApolloResponse: any;
    try {
      const apolloResponse = await enrichPerson({ email, linkedinUrl });
      rawApolloResponse = apolloResponse;
      console.log('✅ Apollo enrichment successful');
    } catch (error: any) {
      console.error('❌ Apollo enrichment error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Enrichment failed',
          details: error.message || 'Failed to enrich contact',
        },
        { status: 500 },
      );
    }

    // Normalize contact and company fields
    const normalizedContact = normalizeContactApollo(rawApolloResponse);
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

    // INFERENCE LAYER - Compute non-score inferences
    // 1. Calculate career statistics
    const employmentHistory = apolloPayload.person?.employment_history || [];
    
    // Debug logging to diagnose date parsing issues
    if (employmentHistory.length > 0) {
      console.log('📊 Employment history found:', employmentHistory.length, 'jobs');
      console.log('📅 Sample job dates:', JSON.stringify(employmentHistory[0], null, 2));
    } else {
      console.log('⚠️ No employment history found in Apollo payload');
    }
    
    const tenureYears = calculateTenureYears(employmentHistory); // Keep for backward compatibility
    const careerStats = calculateCareerStats(employmentHistory);
    const careerTimeline = generateCareerTimeline(employmentHistory);
    
    // Debug logging for calculated stats
    console.log('📈 Career stats calculated:', {
      currentTenureYears: careerStats.currentTenureYears,
      totalExperienceYears: careerStats.totalExperienceYears,
      avgTenureYears: careerStats.avgTenureYears,
    });

    // 2. Generate contact profile summary (GPT)
    let profileSummary = '';
    try {
      profileSummary = await generateContactProfileSummary(
        {
          firstName: normalizedContact.firstName,
          lastName: normalizedContact.lastName,
          title: normalizedContact.title,
          normalizedEmploymentHistory: employmentHistory,
          seniorityScore: intelligenceScores.seniorityScore,
          buyingPowerScore: intelligenceScores.buyingPowerScore,
          tenureYears,
        },
        {
          companyName: normalizedCompany.companyName,
          companyReadinessScore: companyIntelligence.readinessScore,
          headcount: normalizedCompany.headcount,
          revenue: normalizedCompany.revenue,
        }
      );
    } catch (error: any) {
      console.warn('⚠️ Profile summary generation failed (non-critical):', error.message);
    }

    // 3. Enrich company positioning (GPT + deterministic tiers)
    let companyPositioning = {
      positioningLabel: '',
      category: '',
      revenueTier: '',
      headcountTier: '',
      normalizedIndustry: '',
      competitors: [] as string[],
    };
    try {
      companyPositioning = await enrichCompanyPositioning({
        companyName: normalizedCompany.companyName,
        industry: normalizedCompany.industry,
        revenue: normalizedCompany.revenue,
        headcount: normalizedCompany.headcount,
      });
    } catch (error: any) {
      console.warn('⚠️ Company positioning enrichment failed (non-critical):', error.message);
    }

    // Generate preview ID
    const previewId = `preview:${Date.now()}:${Math.random().toString(36).substring(7)}`;
    const redisKey = `apollo:${previewId}`;

    // Store in Redis
    try {
      const redisClient = getRedis();
      const ttl = 7 * 24 * 60 * 60; // 7 days

      // Store raw Apollo JSON
      await redisClient.setex(
        redisKey,
        ttl,
        JSON.stringify({
          rawEnrichmentPayload: rawApolloResponse,
          enrichedAt: new Date().toISOString(),
        })
      );

      // Store normalized data + intelligence scores + inferences under previewId
      await redisClient.setex(
        previewId,
        ttl,
        JSON.stringify({
          previewId,
          redisKey,
          linkedinUrl: linkedinUrl || null,
          email: email || null,
          contactId: contactId || null,
          normalizedContact,
          normalizedCompany,
          intelligenceScores,
          companyIntelligence,
          // Inference layer fields
          profileSummary,
          tenureYears, // Keep for backward compatibility
          currentTenureYears: careerStats.currentTenureYears,
          totalExperienceYears: careerStats.totalExperienceYears,
          avgTenureYears: careerStats.avgTenureYears,
          careerTimeline,
          companyPositioning,
          createdAt: new Date().toISOString(),
        })
      );

      console.log(`✅ Intelligence data stored in Redis: ${previewId}`);
    } catch (redisError: any) {
      console.warn('⚠️ Redis store failed (non-critical):', redisError.message);
      // Continue - we can still return preview data
    }

    // Return preview data with intelligence scores + inferences
    // IMPORTANT: Also return rawApolloResponse so frontend can send it directly to save route (no Redis needed!)
    return NextResponse.json({
      success: true,
      previewId,
      redisKey,
      rawEnrichmentPayload: rawApolloResponse, // Return raw payload so frontend can send it directly
      normalizedContact,
      normalizedCompany,
      intelligenceScores,
      companyIntelligence,
      // Inference layer fields
      profileSummary,
      tenureYears, // Keep for backward compatibility
      currentTenureYears: careerStats.currentTenureYears,
      totalExperienceYears: careerStats.totalExperienceYears,
      avgTenureYears: careerStats.avgTenureYears,
      careerTimeline,
      companyPositioning,
      message: 'Intelligence generated successfully. Use previewId to retrieve data.',
    });
  } catch (error: any) {
    console.error('❌ Generate intelligence error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate intelligence',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

