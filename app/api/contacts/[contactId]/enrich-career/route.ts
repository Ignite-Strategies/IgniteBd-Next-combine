import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';
import { enrichPerson } from '@/lib/apollo';
import { calculateCareerStats, generateCareerTimeline } from '@/lib/intelligence/EnrichmentParserService';
import { inferWhatTheyreLookingFor, inferCareerMomentum } from '@/lib/utils/contactExtraction';

/**
 * POST /api/contacts/[contactId]/enrich-career
 * 
 * Career-focused enrichment for existing contact
 * Extracts: career timeline, tenure, career signals, "what they're looking for"
 * Saves to Contact only - NO Company record creation
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
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
    const resolvedParams = await params;
    const contactId = resolvedParams.contactId;
    const body = await request.json();
    const { companyHQId, linkedinUrl, email } = body;

    // Get existing contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Verify membership
    const targetCompanyHQId = companyHQId || contact.crmId;
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });

    if (owner) {
      const { membership } = await resolveMembership(owner.id, targetCompanyHQId);
      if (!membership) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
          { status: 403 },
        );
      }
    }

    // Enrich from Apollo
    const enrichUrl = linkedinUrl || contact.linkedinUrl;
    const enrichEmail = email || contact.email;

    if (!enrichUrl && !enrichEmail) {
      return NextResponse.json(
        { success: false, error: 'LinkedIn URL or email required for enrichment' },
        { status: 400 },
      );
    }

    let apolloResponse: any;
    try {
      apolloResponse = await enrichPerson({
        linkedinUrl: enrichUrl || undefined,
        email: enrichEmail || undefined,
      });
    } catch (error: any) {
      console.error('❌ Apollo enrichment error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Enrichment failed',
          details: error.message || 'Failed to enrich contact from Apollo',
        },
        { status: 500 },
      );
    }

    // Extract employment history
    const employmentHistory = 
      (apolloResponse.person as any)?.employment_history || 
      (apolloResponse.person as any)?.employmentHistory ||
      [];

    // Calculate career stats
    const careerStats = calculateCareerStats(employmentHistory);
    
    // Generate career timeline
    const careerTimeline = generateCareerTimeline(employmentHistory);

    // Extract career signals
    const recentJobChange = careerStats.currentTenureYears < 0.5;
    const recentPromotion = false; // Would need to compare titles, skip for now
    
    // Determine career progression
    let careerProgression: 'upward' | 'lateral' | 'downward' | null = null;
    if (employmentHistory.length >= 2) {
      const titles = employmentHistory
        .filter((job: any) => job.title)
        .map((job: any) => job.title.toLowerCase());
      
      // Simple heuristic: check if titles show progression
      if (titles.some((t: string) => t.includes('vp') || t.includes('director')) &&
          titles.some((t: string) => t.includes('manager') || t.includes('senior'))) {
        careerProgression = 'upward';
      }
    }

    // Infer career signals
    const contactForInference = {
      recentJobChange,
      currentTenureYears: careerStats.currentTenureYears,
      numberOfJobChanges: employmentHistory.length - 1, // Exclude current role
      averageTenureMonths: careerStats.avgTenureYears * 12,
      recentPromotion,
      careerProgression,
    };

    const whatTheyreLookingFor = inferWhatTheyreLookingFor(contactForInference);
    const careerMomentum = inferCareerMomentum(contactForInference);

    // Update contact with career data
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        // Career timeline
        careerTimeline: careerTimeline.length > 0 ? careerTimeline : null,
        
        // Career stats
        currentTenureYears: careerStats.currentTenureYears,
        totalYearsExperience: careerStats.totalExperienceYears,
        totalExperienceYears: careerStats.totalExperienceYears, // Keep both for compatibility
        numberOfJobChanges: employmentHistory.length > 0 ? employmentHistory.length - 1 : null,
        averageTenureMonths: careerStats.avgTenureYears * 12,
        avgTenureYears: careerStats.avgTenureYears,
        
        // Career signals
        recentJobChange,
        recentPromotion,
        careerProgression,
        careerMomentum,
        whatTheyreLookingFor,
        
        // Update enrichment metadata
        enrichmentSource: 'Apollo',
        enrichmentFetchedAt: new Date(),
        enrichmentPayload: JSON.stringify(apolloResponse),
      },
    });

    return NextResponse.json({
      success: true,
      contact: updatedContact,
      careerTimeline,
      careerStats,
      signals: {
        recentJobChange,
        recentPromotion,
        careerProgression,
        careerMomentum,
        whatTheyreLookingFor,
      },
    });
  } catch (error: any) {
    console.error('❌ Career enrichment error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to enrich career history',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

