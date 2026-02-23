import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

const SNIP_TYPES = ['subject', 'intent', 'service', 'competitor', 'value', 'cta', 'relationship', 'generic'];
const CONTEXT_TYPES = ['email', 'blog', 'linkedin', 'internal', 'multi'];
const INTENT_TYPES = ['reactivation', 'prior_contact', 'intro', 'competitor', 'seasonal', 'relationship_only'];

/**
 * GET /api/outreach/content-snips/[id]
 */
export async function GET(request, { params }) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const id = params?.id;
  if (!id) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const snip = await prisma.content_snips.findUnique({
    where: { id },
  });
  if (!snip) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, snip.companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ success: true, snip });
}

/**
 * PUT /api/outreach/content-snips/[id]
 * Body: { snipName?, snipText?, snipType?, contextType?, intentType?, isActive? }
 */
export async function PUT(request, { params }) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const id = params?.id;
  if (!id) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const existing = await prisma.content_snips.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, existing.companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const data = { updatedAt: new Date() };

  if (body.snipName !== undefined) {
    const name = String(body.snipName).trim().replace(/\s+/g, '_').toLowerCase();
    if (name) data.snipName = name;
  }
  if (body.snipText !== undefined) data.snipText = String(body.snipText);
  if (body.snipType !== undefined && SNIP_TYPES.includes(body.snipType)) data.snipType = body.snipType;
  if (body.contextType !== undefined) data.contextType = body.contextType && CONTEXT_TYPES.includes(body.contextType) ? body.contextType : null;
  if (body.intentType !== undefined) data.intentType = body.intentType && INTENT_TYPES.includes(body.intentType) ? body.intentType : null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const snip = await prisma.content_snips.update({
    where: { id },
    data,
  });

  return NextResponse.json({ success: true, snip });
}

/**
 * DELETE /api/outreach/content-snips/[id]
 */
export async function DELETE(request, { params }) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const id = params?.id;
  if (!id) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const existing = await prisma.content_snips.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, existing.companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  await prisma.content_snips.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
