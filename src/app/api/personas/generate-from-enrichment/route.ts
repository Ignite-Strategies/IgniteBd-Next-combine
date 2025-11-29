/**
 * POST /api/personas/generate-from-enrichment
 * 
 * Generate a Persona from enriched contact data.
 * 
 * This is the natural next step after contact enrichment:
 * 1. User enriches contact (Apollo) → saves to contact
 * 2. Success modal → "Start Persona Flow" button
 * 3. Persona builder → calls this endpoint to generate persona
 * 
 * ProductFit and BdIntel are generated separately later (when viewing/editing persona).
 * 
 * Body:
 * {
 *   "contactId": "contact_123", // OR
 *   "redisKey": "preview:123:abc" | "apollo:enriched:https://linkedin.com/...",
 *   "companyHQId": "company_hq_123",
 *   "mode": "hydrate" | "save",
 *   "notes": "Optional freeform notes" (optional)
 * }
 * 
 * Response (mode: "hydrate"):
 * {
 *   "success": true,
 *   "persona": { ... }
 * }
 * 
 * Response (mode: "save"):
 * {
 *   "success": true,
 *   "persona": { ... } // Saved to DB
 * }
 */

import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { EnrichmentToPersonaService } from '@/lib/services/EnrichmentToPersonaService';

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
    const { redisKey, contactId, companyHQId, mode, notes } = body;

    if (!redisKey && !contactId) {
      return NextResponse.json(
        { success: false, error: 'Either redisKey or contactId is required' },
        { status: 400 },
      );
    }

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    if (!mode || (mode !== 'hydrate' && mode !== 'save')) {
      return NextResponse.json(
        { success: false, error: 'mode must be "hydrate" or "save"' },
        { status: 400 },
      );
    }

    console.log(`🚀 Generating persona from enrichment (mode: ${mode})...`);

    const result = await EnrichmentToPersonaService.run({
      redisKey,
      contactId,
      companyHQId,
      mode,
      notes,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to generate persona',
          details: result.details,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      persona: result.persona,
      mode,
    });
  } catch (error: any) {
    console.error('❌ Unified persona generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate persona',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

