import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { optionallyVerifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/contacts/hydrate
 * Comprehensive hydration endpoint for contacts
 * Fetches all contacts with full relations for a companyHQ
 * 
 * Query params:
 * - companyHQId (required)
 * - pipeline (optional) - Filter by pipeline
 * - stage (optional) - Filter by stage
 * 
 * Returns:
 * - contacts: Array of contacts with pipeline, company, and contactCompany relations
 * - stats: Counts and metrics
 */
export async function GET(request) {
  // Use optionalAuth for GET (read operation, scoped by companyHQId)
  await optionallyVerifyFirebaseToken(request);

  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');
    const pipeline = searchParams.get('pipeline');
    const stage = searchParams.get('stage');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    console.log(`🚀 CONTACT HYDRATE: Fetching all contacts for companyHQId: ${companyHQId}`);

    // Build where clause
    const where = {
      crmId: companyHQId,
    };

    if (pipeline || stage) {
      where.pipeline = {};
      if (pipeline) {
        where.pipeline.pipeline = pipeline;
      }
      if (stage) {
        where.pipeline.stage = stage;
      }
    }

    // Fetch contacts with all relations
    const contacts = await prisma.contact.findMany({
      where,
      include: {
        pipeline: true,
        company: true, // Universal company relation
        contactCompany: true, // Legacy relation for backward compatibility
      },
      orderBy: {
        createdAt: 'desc',
      },
    }).catch(() => []); // Return empty array on error

    // Calculate stats
    const stats = {
      total: contacts.length,
      byPipeline: {},
      byStage: {},
    };

    contacts.forEach((contact) => {
      if (contact.pipeline) {
        const pipelineName = contact.pipeline.pipeline || 'unknown';
        const stageName = contact.pipeline.stage || 'unknown';
        
        stats.byPipeline[pipelineName] = (stats.byPipeline[pipelineName] || 0) + 1;
        stats.byStage[stageName] = (stats.byStage[stageName] || 0) + 1;
      }
    });

    return NextResponse.json({
      success: true,
      contacts,
      stats,
    });
  } catch (error) {
    console.error('❌ ContactHydrate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to hydrate contacts',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

