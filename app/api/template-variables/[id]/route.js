import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

const SOURCES = ['CONTACT', 'OWNER', 'COMPUTED', 'CUSTOM'];

function normalizeVariableKey(s) {
  return String(s).trim().replace(/\s+/g, '_').toLowerCase() || null;
}

/**
 * GET /api/template-variables/[id]
 */
export async function GET(request, { params }) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const variable = await prisma.template_variables.findUnique({
    where: { id },
  });

  if (!variable) {
    return NextResponse.json({ success: false, error: 'Variable not found' }, { status: 404 });
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, variable.companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ success: true, variable });
}

/**
 * PUT /api/template-variables/[id]
 */
export async function PUT(request, { params }) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const { variableKey, description, source, dbField, computedRule, isBuiltIn, isActive } = body;

  const existing = await prisma.template_variables.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Variable not found' }, { status: 404 });
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, existing.companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const updateData = {};
  if (variableKey !== undefined) {
    const key = normalizeVariableKey(variableKey);
    if (!key) {
      return NextResponse.json({ success: false, error: 'variableKey cannot be empty' }, { status: 400 });
    }
    // Check for uniqueness if key changed
    if (key !== existing.variableKey) {
      const duplicate = await prisma.template_variables.findUnique({
        where: {
          companyHQId_variableKey: { companyHQId: existing.companyHQId, variableKey: key },
        },
      });
      if (duplicate) {
        return NextResponse.json({ success: false, error: 'Variable key already exists' }, { status: 400 });
      }
      updateData.variableKey = key;
    }
  }
  if (description !== undefined) updateData.description = description || null;
  if (source !== undefined) {
    if (!SOURCES.includes(source)) {
      return NextResponse.json(
        { success: false, error: `source must be one of: ${SOURCES.join(', ')}` },
        { status: 400 },
      );
    }
    updateData.source = source;
  }
  if (dbField !== undefined) updateData.dbField = dbField || null;
  if (computedRule !== undefined) updateData.computedRule = computedRule || null;
  if (isBuiltIn !== undefined) updateData.isBuiltIn = isBuiltIn === true;
  if (isActive !== undefined) updateData.isActive = isActive !== false;

  const variable = await prisma.template_variables.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ success: true, variable });
}

/**
 * DELETE /api/template-variables/[id]
 */
export async function DELETE(request, { params }) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const existing = await prisma.template_variables.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Variable not found' }, { status: 404 });
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, existing.companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Don't allow deleting built-in variables
  if (existing.isBuiltIn) {
    return NextResponse.json({ success: false, error: 'Cannot delete built-in variables' }, { status: 400 });
  }

  await prisma.template_variables.delete({
    where: { id },
  });

  return NextResponse.json({ success: true, message: 'Variable deleted successfully' });
}
