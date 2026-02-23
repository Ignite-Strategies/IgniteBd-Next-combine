import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/outreach-personas/[slug]
 * Get a single persona by slug
 */
export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const slug = params?.slug;
  if (!slug) {
    return NextResponse.json({ success: false, error: 'slug required' }, { status: 400 });
  }

  const persona = await prisma.outreach_personas.findUnique({
    where: { slug },
  });

  if (!persona) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, persona });
}

/**
 * PUT /api/outreach-personas/[slug]
 * Update a persona
 * Body: { name?, description? }
 */
export async function PUT(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const slug = params?.slug;
  if (!slug) {
    return NextResponse.json({ success: false, error: 'slug required' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, description } = body;

  const existing = await prisma.outreach_personas.findUnique({
    where: { slug },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const data = {};
  if (name !== undefined) data.name = String(name).trim();
  if (description !== undefined) data.description = description ? String(description).trim() : null;

  const persona = await prisma.outreach_personas.update({
    where: { slug },
    data,
  });

  return NextResponse.json({ success: true, persona });
}

/**
 * DELETE /api/outreach-personas/[slug]
 * Delete a persona
 */
export async function DELETE(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const slug = params?.slug;
  if (!slug) {
    return NextResponse.json({ success: false, error: 'slug required' }, { status: 400 });
  }

  // Check if persona is used by any contacts or snippets
  const contactsUsing = await prisma.contact.count({
    where: { outreachPersonaSlug: slug },
  });

  const snippetsUsing = await prisma.content_snips.findMany({
    where: {
      assemblyHelperPersonas: {
        has: slug,
      },
    },
    select: { id: true },
    take: 1,
  });

  if (contactsUsing > 0 || snippetsUsing.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot delete: persona is used by ${contactsUsing} contact(s) and ${snippetsUsing.length} snippet(s)`,
      },
      { status: 400 },
    );
  }

  await prisma.outreach_personas.delete({
    where: { slug },
  });

  return NextResponse.json({ success: true });
}
