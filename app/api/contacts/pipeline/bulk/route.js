import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';
import { applyContactPipelineUpdate } from '@/lib/services/contactPipelineApply';

const MAX_BULK = 100;

/**
 * POST /api/contacts/pipeline/bulk
 *
 * Body:
 * - companyHQId (required)
 * - contactIds (string[], required, max MAX_BULK)
 * - pipeline (required)
 * - stage (optional for unassigned/no-role; required otherwise)
 *
 * All contactIds must belong to companyHQId (crmId). Otherwise 400.
 * Per-contact failures are returned in results[]; HTTP 200 with partial success.
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { companyHQId, contactIds, pipeline, stage } = body ?? {};

    if (!companyHQId || typeof companyHQId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'contactIds must be a non-empty array' },
        { status: 400 },
      );
    }

    const uniqueIds = [...new Set(contactIds.map((id) => String(id)))];
    if (uniqueIds.length > MAX_BULK) {
      return NextResponse.json(
        { success: false, error: `At most ${MAX_BULK} distinct contacts per request` },
        { status: 400 },
      );
    }

    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 },
      );
    }

    const allowed = await prisma.contact.findMany({
      where: {
        id: { in: uniqueIds },
        crmId: companyHQId,
      },
      select: { id: true },
    });

    const allowedSet = new Set(allowed.map((c) => c.id));
    if (allowedSet.size !== uniqueIds.length) {
      const missing = uniqueIds.filter((id) => !allowedSet.has(id));
      return NextResponse.json(
        {
          success: false,
          error: 'Some contacts were not found or do not belong to this CompanyHQ',
          invalidContactIds: missing,
        },
        { status: 400 },
      );
    }

    const results = [];
    let ok = 0;
    let failed = 0;

    for (const contactId of uniqueIds) {
      const result = await applyContactPipelineUpdate(contactId, { pipeline, stage });
      if (!result.success) {
        failed += 1;
        results.push({ contactId, ok: false, error: result.error });
      } else {
        ok += 1;
        results.push({
          contactId,
          ok: true,
          converted: result.converted,
        });
      }
    }

    return NextResponse.json({
      success: true,
      updated: ok,
      failed,
      results,
    });
  } catch (error) {
    console.error('❌ Bulk pipeline update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update pipelines',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
