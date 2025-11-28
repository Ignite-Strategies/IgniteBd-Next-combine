/**
 * POST /api/personas/generate-unified
 * 
 * Unified persona generation pipeline - generates Persona, ProductFit, and BdIntel in one call.
 * 
 * This replaces the previous 3-step pipeline:
 * - Old: POST /api/personas/generate → POST /api/personas/[id]/product-fit → POST /api/personas/[id]/bd-intel
 * - New: POST /api/personas/generate-unified (single call)
 * 
 * Body:
 * {
 *   "redisKey": "preview:123:abc" | "apollo:enriched:https://linkedin.com/...",
 *   "companyHQId": "company_hq_123",
 *   "mode": "hydrate" | "save",
 *   "notes": "Optional freeform notes" (optional)
 * }
 * 
 * Response (mode: "hydrate"):
 * {
 *   "success": true,
 *   "persona": { ... },
 *   "productFit": { ... },
 *   "bdIntel": { ... }
 * }
 * 
 * Response (mode: "save"):
 * {
 *   "success": true,
 *   "persona": { ... }, // Saved to DB
 *   "productFit": { ... }, // Saved to DB
 *   "bdIntel": { ... } // Saved to DB
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
    const { redisKey, companyHQId, mode, notes } = body;

    if (!redisKey) {
      return NextResponse.json(
        { success: false, error: 'redisKey is required' },
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

    console.log(`🚀 Running unified persona generation (mode: ${mode})...`);

    const result = await EnrichmentToPersonaService.run({
      redisKey,
      companyHQId,
      mode,
      notes,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to generate persona pipeline',
          details: result.details,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      persona: result.persona,
      productFit: result.productFit,
      bdIntel: result.bdIntel,
      mode,
    });
  } catch (error: any) {
    console.error('❌ Unified persona generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate persona pipeline',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

