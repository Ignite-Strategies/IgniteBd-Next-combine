import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

const TEMPLATE_POSITIONS = ['SUBJECT_LINE', 'OPENING_GREETING', 'CATCH_UP', 'BUSINESS_CONTEXT', 'VALUE_PROPOSITION', 'COMPETITOR_FRAME', 'TARGET_ASK', 'SOFT_CLOSE'];

/**
 * GET /api/outreach/content-snips/[id] — id can be snipId or snipSlug
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

  const snip = await prisma.contentSnip.findFirst({
    where: { OR: [{ snipId: id }, { snipSlug: id }] },
  });
  if (!snip) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, snip });
}

/**
 * PUT /api/outreach/content-snips/[id]
 * Body: { snipName?, snipSlug?, snipText?, templatePosition?, personaSlug?, bestUsedWhen? }
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

  const existing = await prisma.contentSnip.findFirst({
    where: { OR: [{ snipId: id }, { snipSlug: id }] },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data = { updatedAt: new Date() };

  if (body.snipName !== undefined) {
    const name = String(body.snipName).trim().replace(/\s+/g, '_').toLowerCase();
    if (name) data.snipName = name;
  }
  if (body.snipSlug !== undefined) {
    const slug = String(body.snipSlug).trim().toLowerCase().replace(/\s+/g, '_');
    if (slug) data.snipSlug = slug;
  }
  if (body.snipText !== undefined) data.snipText = String(body.snipText);
  if (body.templatePosition !== undefined && TEMPLATE_POSITIONS.includes(body.templatePosition)) data.templatePosition = body.templatePosition;
  if (body.personaSlug !== undefined) data.personaSlug = body.personaSlug ? String(body.personaSlug).trim() : null;
  if (body.bestUsedWhen !== undefined) data.bestUsedWhen = body.bestUsedWhen ? String(body.bestUsedWhen).trim() : null;

  const snip = await prisma.contentSnip.update({
    where: { snipId: existing.snipId },
    data,
  });

  return NextResponse.json({ success: true, snip });
}

/**
 * DELETE /api/outreach/content-snips/[id] — id can be snipId or snipSlug
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

  const existing = await prisma.contentSnip.findFirst({
    where: { OR: [{ snipId: id }, { snipSlug: id }] },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  await prisma.contentSnip.delete({
    where: { snipId: existing.snipId },
  });

  return NextResponse.json({ success: true });
}
