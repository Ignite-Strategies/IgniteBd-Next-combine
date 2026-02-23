import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';
import { parseCSV } from '@/lib/utils/csv';

const SNIP_TYPES = ['subject', 'opening', 'service', 'competitor', 'value', 'cta', 'relationship', 'generic'];

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
 * FormData: file (CSV), companyHQId
 * CSV columns (any case): snip_name / snipName, snip_text / snipText, snip_type / snipType, assembly_helper_personas / assemblyHelperPersonas (optional, comma-separated slugs)
 * snip_type required (or default 'generic'); snip_name and snip_text required per row.
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

  let companyHQId = request.nextUrl?.searchParams?.get('companyHQId') || formData.get('companyHQId');
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
    const snipText = getRowValue(row, 'snip_text', 'snipText', 'text', 'body');
    let snipType = getRowValue(row, 'snip_type', 'snipType', 'type');
    const assemblyHelperPersonasRaw = getRowValue(row, 'assembly_helper_personas', 'assemblyHelperPersonas', 'helperPersonas');

    if (!snipName || !snipText) {
      errors.push(`Row ${i + 2}: snip_name and snip_text are required`);
      continue;
    }

    const name = normalizeSnipName(snipName);
    if (!name) {
      errors.push(`Row ${i + 2}: invalid snip_name`);
      continue;
    }

    if (!snipType || !SNIP_TYPES.includes(snipType)) {
      snipType = 'generic';
    }

    try {
      const existing = await prisma.content_snips.findUnique({
        where: { companyHQId_snipName: { companyHQId, snipName: name } },
      });

      // Parse and validate persona slugs if provided (comma-separated)
      let personaSlugs = [];
      if (assemblyHelperPersonasRaw) {
        const slugs = assemblyHelperPersonasRaw.split(',').map((s) => s.trim()).filter(Boolean);
        if (slugs.length > 0) {
          const validPersonas = await prisma.outreach_personas.findMany({
            where: { slug: { in: slugs } },
            select: { slug: true },
          });
          personaSlugs = validPersonas.map((p) => p.slug);
        }
      }

      if (existing) {
        await prisma.content_snips.update({
          where: { id: existing.id },
          data: {
            snipText,
            snipType,
            assemblyHelperPersonas: personaSlugs,
            updatedAt: new Date(),
          },
        });
        updated += 1;
      } else {
        await prisma.content_snips.create({
          data: {
            companyHQId,
            snipName: name,
            snipText,
            snipType,
            assemblyHelperPersonas: personaSlugs,
            isActive: true,
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
