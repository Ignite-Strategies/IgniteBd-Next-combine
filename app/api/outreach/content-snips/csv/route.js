import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';
import { parseCSV } from '@/lib/utils/csv';

const TEMPLATE_POSITIONS = ['SUBJECT_LINE', 'OPENING_GREETING', 'CATCH_UP', 'BUSINESS_CONTEXT', 'VALUE_PROPOSITION', 'COMPETITOR_FRAME', 'TARGET_ASK', 'SOFT_CLOSE'];

// Map legacy CSV snip_type / type to TemplatePosition (for backward compatibility)
const LEGACY_TYPE_TO_POSITION = {
  subject: 'SUBJECT_LINE',
  opening: 'OPENING_GREETING',
  service: 'BUSINESS_CONTEXT',
  competitor: 'COMPETITOR_FRAME',
  value: 'VALUE_PROPOSITION',
  cta: 'TARGET_ASK',
  relationship: 'SOFT_CLOSE',
  generic: 'SOFT_CLOSE',
  intent: 'OPENING_GREETING',
};

// Normalize CSV row keys (headers may be snip_name, snipName, Snip Name, etc.)
function getRowValue(row, ...keys) {
  const lower = (v) => (v || '').toLowerCase().replace(/\s+/g, '');
  for (const key of keys) {
    const found = Object.keys(row).find((h) => lower(h) === lower(key));
    if (found && row[found] != null && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return null;
}

function normalizeSnipName(s) {
  return String(s).trim().replace(/\s+/g, '_').toLowerCase() || null;
}

/**
 * POST /api/outreach/content-snips/csv
 * FormData: file (CSV), companyHQId (for auth)
 * CSV columns: snip_name, snip_slug (optional), snip_text, template_position (or legacy snip_type), persona_slug, best_used_when
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ success: false, error: 'Form data required' }, { status: 400 });
  }

  const companyHQId = request.nextUrl?.searchParams?.get('companyHQId') || formData.get('companyHQId');
  if (!companyHQId) {
    return NextResponse.json({ success: false, error: 'companyHQId is required' }, { status: 400 });
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const file = formData.get('file');
  if (!file) {
    return NextResponse.json({ success: false, error: 'CSV file is required' }, { status: 400 });
  }

  const csvText = await file.text();
  const parsed = parseCSV(csvText);

  if (parsed.errors && parsed.errors.length > 0) {
    return NextResponse.json(
      { success: false, error: 'CSV parse errors', errors: parsed.errors },
      { status: 400 },
    );
  }

  const rows = parsed.rows || [];
  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: 'CSV has no data rows' }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const snipName = getRowValue(row, 'snip_name', 'snipName', 'name');
    const snipSlugRaw = getRowValue(row, 'snip_slug', 'snipSlug', 'slug');
    const snipText = getRowValue(row, 'snip_text', 'snipText', 'text', 'body');
    let templatePosition = getRowValue(row, 'template_position', 'templatePosition', 'position');
    const legacyType = getRowValue(row, 'snip_type', 'snipType', 'type');
    const personaSlug = getRowValue(row, 'persona_slug', 'personaSlug') || null;
    const bestUsedWhen = getRowValue(row, 'best_used_when', 'bestUsedWhen') || null;

    if (!snipName || !snipText) {
      errors.push(`Row ${i + 2}: snip_name and snip_text are required`);
      continue;
    }

    const name = normalizeSnipName(snipName);
    if (!name) {
      errors.push(`Row ${i + 2}: invalid snip_name`);
      continue;
    }

    const slug = (snipSlugRaw && normalizeSnipName(snipSlugRaw)) || name;

    if (templatePosition && TEMPLATE_POSITIONS.includes(templatePosition)) {
      // use as-is
    } else if (legacyType && LEGACY_TYPE_TO_POSITION[legacyType.toLowerCase()]) {
      templatePosition = LEGACY_TYPE_TO_POSITION[legacyType.toLowerCase()];
    } else {
      templatePosition = 'SOFT_CLOSE';
    }

    try {
      const existing = await prisma.contentSnip.findUnique({
        where: { snipSlug: slug },
      });

      if (existing) {
        await prisma.contentSnip.update({
          where: { snipId: existing.snipId },
          data: {
            snipName: name,
            snipText,
            templatePosition,
            personaSlug: personaSlug?.trim() || null,
            bestUsedWhen: bestUsedWhen?.trim() || null,
            updatedAt: new Date(),
          },
        });
        updated += 1;
      } else {
        await prisma.contentSnip.create({
          data: {
            snipName: name,
            snipSlug: slug,
            snipText,
            templatePosition,
            personaSlug: personaSlug?.trim() || null,
            bestUsedWhen: bestUsedWhen?.trim() || null,
          },
        });
        created += 1;
      }
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message || 'Failed to save'}`);
    }
  }

  return NextResponse.json({
    success: true,
    created,
    updated,
    total: rows.length,
    errors: errors.length ? errors : undefined,
  });
}
