import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * GET /api/outreach/snippets?companyHQId=xxx
 * List all template snippets for the company.
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
    return NextResponse.json({ success: false, error: 'Forbidden: No membership in this CompanyHQ' }, { status: 403 });
  }

  const snippets = await prisma.template_snippets.findMany({
    where: { companyHQId },
    orderBy: { variableName: 'asc' },
  });

  return NextResponse.json({ success: true, snippets });
}

/**
 * POST /api/outreach/snippets
 * Body: { companyHQId, variableName, name, body }
 * Create or update a snippet (upsert by companyHQId + variableName).
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { companyHQId, variableName, name, intentType, body: snippetBody } = body;
  if (!companyHQId || !variableName || !name) {
    return NextResponse.json(
      { success: false, error: 'companyHQId, variableName, and name are required' },
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
    return NextResponse.json({ success: false, error: 'Forbidden: No membership in this CompanyHQ' }, { status: 403 });
  }

  const cleanVar = String(variableName).trim().replace(/\s+/g, '_').toLowerCase();
  if (!cleanVar) {
    return NextResponse.json({ success: false, error: 'variableName cannot be empty' }, { status: 400 });
  }

  const updatePayload = {
    name: String(name).trim(),
    body: typeof snippetBody === 'string' ? snippetBody : '',
    updatedAt: new Date(),
  };
  if (intentType !== undefined) updatePayload.intentType = intentType === '' || intentType == null ? null : String(intentType).trim();

  const createPayload = {
    companyHQId,
    variableName: cleanVar,
    name: String(name).trim(),
    body: typeof snippetBody === 'string' ? snippetBody : '',
  };
  if (intentType !== undefined && intentType !== '' && intentType != null) createPayload.intentType = String(intentType).trim();

  const snippet = await prisma.template_snippets.upsert({
    where: {
      companyHQId_variableName: { companyHQId, variableName: cleanVar },
    },
    update: updatePayload,
    create: createPayload,
  });

  return NextResponse.json({ success: true, snippet });
}
