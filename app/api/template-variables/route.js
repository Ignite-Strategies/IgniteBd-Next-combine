import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

const SOURCES = ['CONTACT', 'OWNER', 'COMPUTED', 'CUSTOM'];

function normalizeVariableKey(s) {
  return String(s).trim().replace(/\s+/g, '_').toLowerCase() || null;
}

/**
 * GET /api/template-variables?companyHQId=xxx&source=xxx&activeOnly=true
 */
export async function GET(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const companyHQId = request.nextUrl?.searchParams?.get('companyHQId');
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

  const source = request.nextUrl?.searchParams?.get('source');
  const activeOnly = request.nextUrl?.searchParams?.get('activeOnly') !== 'false';

  const where = { companyHQId };
  if (activeOnly) where.isActive = true;
  if (source && SOURCES.includes(source)) where.source = source;

  const variables = await prisma.template_variables.findMany({
    where,
    orderBy: [{ isBuiltIn: 'desc' }, { source: 'asc' }, { variableKey: 'asc' }],
  });

  return NextResponse.json({ success: true, variables });
}

/**
 * POST /api/template-variables
 * Body: { companyHQId, variableKey, description?, source, dbField?, computedRule?, isBuiltIn?, isActive? }
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { companyHQId, variableKey, description, source, dbField, computedRule, isBuiltIn, isActive } = body;

  if (!companyHQId || !variableKey || !source) {
    return NextResponse.json(
      { success: false, error: 'companyHQId, variableKey, and source are required' },
      { status: 400 },
    );
  }

  if (!SOURCES.includes(source)) {
    return NextResponse.json(
      { success: false, error: `source must be one of: ${SOURCES.join(', ')}` },
      { status: 400 },
    );
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

  const key = normalizeVariableKey(variableKey);
  if (!key) {
    return NextResponse.json({ success: false, error: 'variableKey cannot be empty' }, { status: 400 });
  }

  const variable = await prisma.template_variables.upsert({
    where: {
      companyHQId_variableKey: { companyHQId, variableKey: key },
    },
    update: {
      description: description || null,
      source,
      dbField: dbField || null,
      computedRule: computedRule || null,
      isBuiltIn: isBuiltIn === true,
      isActive: isActive !== false,
      updatedAt: new Date(),
    },
    create: {
      companyHQId,
      variableKey: key,
      description: description || null,
      source,
      dbField: dbField || null,
      computedRule: computedRule || null,
      isBuiltIn: isBuiltIn === true,
      isActive: isActive !== false,
    },
  });

  return NextResponse.json({ success: true, variable });
}
