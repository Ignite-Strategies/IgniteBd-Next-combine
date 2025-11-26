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

      // Store normalized data + intelligence scores under previewId
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
          createdAt: new Date().toISOString(),
        })
      );

      console.log(`✅ Intelligence data stored in Redis: ${previewId}`);
    } catch (redisError: any) {
      console.warn('⚠️ Redis store failed (non-critical):', redisError.message);
      // Continue - we can still return preview data
    }

    // Return preview data with intelligence scores
    return NextResponse.json({
      success: true,
      previewId,
      redisKey,
      normalizedContact,
      normalizedCompany,
      intelligenceScores,
      companyIntelligence,
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

