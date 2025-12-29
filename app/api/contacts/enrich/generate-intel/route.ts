import { NextResponse } from 'next/server';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { enrichPerson, normalizeApolloResponse } from '@/lib/apollo';
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
  generateCareerTimeline,
  enrichCompanyPositioning,
  type ApolloEnrichmentPayload,
} from '@/lib/intelligence/EnrichmentParserService';
import {
  calculateCareerStats,
  calculateTenureYears,
} from '@/lib/services/CareerStatsService';

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
 *   "rawEnrichmentPayload": {...},
 *   "profileSummary": "...",
 *   "currentTenureYears": 2.5,
 *   "totalExperienceYears": 10.0,
 *   "avgTenureYears": 3.3,
 *   "careerTimeline": [...],
 *   "companyPositioning": {...}
 * }
 * 
 * NO Redis storage - all data returned in response
 * Frontend stores in component state and sends directly to save route
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
    // Log the entire Apollo payload structure to see what we're actually getting
    console.log('🔍 Apollo payload structure:', {
      hasPerson: !!apolloPayload.person,
      personKeys: apolloPayload.person ? Object.keys(apolloPayload.person) : [],
      hasEmploymentHistory: !!(apolloPayload.person as any)?.employment_history,
    });
    
    // Try multiple possible paths for employment history
    const employmentHistory = 
      (apolloPayload.person as any)?.employment_history || 
      (apolloPayload.person as any)?.employmentHistory ||
      (apolloPayload as any)?.employment_history ||
      [];
    
    // Log raw employment history data
    if (employmentHistory.length > 0) {
      console.log('📊 Employment history found:', employmentHistory.length, 'jobs');
      console.log('📅 Full employment history:', JSON.stringify(employmentHistory, null, 2));
      
      // Debug: Check what company name fields are actually present in each job
      employmentHistory.forEach((job, index) => {
        const companyFields = {
          'organization?.name': (job as any).organization?.name,
          'organization.organization_name': (job as any).organization?.organization_name,
          'company': (job as any).company,
          'company_name': (job as any).company_name,
          'org_name': (job as any).org_name,
          'organization_name': (job as any).organization_name,
          'employer': (job as any).employer,
          'employer_name': (job as any).employer_name,
          'allKeys': Object.keys(job),
          'organizationKeys': (job as any).organization ? Object.keys((job as any).organization) : [],
        };
        console.log(`🔍 Job ${index + 1} company name fields:`, JSON.stringify(companyFields, null, 2));
      });
    } else {
      console.log('⚠️ No employment history found in Apollo payload');
      // Log the full person object to see what fields are actually available
      console.log('🔍 Full person object keys:', apolloPayload.person ? Object.keys(apolloPayload.person) : 'no person');
      console.log('🔍 Sample person data:', JSON.stringify(apolloPayload.person, null, 2));
    }
    
    const tenureYears = calculateTenureYears(employmentHistory); // Keep for backward compatibility
    const careerStats = calculateCareerStats(employmentHistory);
    const careerTimeline = generateCareerTimeline(employmentHistory);
    
    // Debug logging for calculated stats
    console.log('📈 Career stats calculated:', {
      currentTenureYears: careerStats.currentTenureYears,
      totalExperienceYears: careerStats.totalExperienceYears,
      avgTenureYears: careerStats.avgTenureYears,
      numberOfJobs: careerStats.numberOfJobs,
      validJobs: careerStats.validJobs,
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

    // Generate preview ID (for backward compatibility, but not used since we don't store in Redis)
    const previewId = `preview:${Date.now()}:${Math.random().toString(36).substring(7)}`;
    const redisKey = `apollo:${previewId}`;

    // NOTE: Redis storage removed - user stays on same page, all data returned in response
    // Frontend stores data in component state and sends directly to save route
    // This eliminates unnecessary Redis calls and makes the flow more reliable

    // Return preview data with intelligence scores + inferences
    // IMPORTANT: Also return rawApolloResponse so frontend can send it directly to save route (no Redis needed!)
    const response = {
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
    };
    
    console.log('📤 Generate-intel response structure:', {
      hasRawEnrichmentPayload: !!response.rawEnrichmentPayload,
      rawPayloadHasPerson: !!response.rawEnrichmentPayload?.person,
      intelligenceScoresKeys: Object.keys(intelligenceScores),
      intelligenceScoresValues: intelligenceScores,
      hasProfileSummary: !!profileSummary,
      careerStats,
    });
    
    return NextResponse.json(response);
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

