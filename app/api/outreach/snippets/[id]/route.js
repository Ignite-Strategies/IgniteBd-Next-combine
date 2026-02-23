import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * GET /api/outreach/snippets/[id]
 * GET one snippet by id (must belong to a companyHQ the user has access to).
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
    return NextResponse.json({ success: false, error: 'Snippet id required' }, { status: 400 });
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const snippet = await prisma.template_snippets.findUnique({
    where: { id },
  });
  if (!snippet) {
    return NextResponse.json({ success: false, error: 'Snippet not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, snippet.companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ success: true, snippet });
}

/**
 * PUT /api/outreach/snippets/[id]
 * Body: { name?, body?, variableName? }
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
    return NextResponse.json({ success: false, error: 'Snippet id required' }, { status: 400 });
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const existing = await prisma.template_snippets.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Snippet not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, existing.companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.body !== undefined) data.body = String(body.body);
  if (body.intentType !== undefined) data.intentType = body.intentType === '' || body.intentType == null ? null : String(body.intentType).trim();
  if (body.variableName !== undefined) {
    const cleanVar = String(body.variableName).trim().replace(/\s+/g, '_').toLowerCase();
    if (cleanVar) data.variableName = cleanVar;
  }
  data.updatedAt = new Date();

  const snippet = await prisma.template_snippets.update({
    where: { id },
    data,
  });

  return NextResponse.json({ success: true, snippet });
}

/**
 * DELETE /api/outreach/snippets/[id]
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
    return NextResponse.json({ success: false, error: 'Snippet id required' }, { status: 400 });
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const existing = await prisma.template_snippets.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Snippet not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, existing.companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  await prisma.template_snippets.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
