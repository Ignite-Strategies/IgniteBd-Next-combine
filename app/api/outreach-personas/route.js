import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/outreach-personas
 * List all outreach personas
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const personas = await prisma.outreach_personas.findMany({
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ success: true, personas });
}

/**
 * POST /api/outreach-personas
 * Create a new outreach persona
 * Body: { slug, name, description? }
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { slug, name, description } = body;

  if (!slug || !name) {
    return NextResponse.json(
      { success: false, error: 'slug and name are required' },
      { status: 400 },
    );
  }

  try {
    const persona = await prisma.outreach_personas.create({
      data: {
        slug: String(slug).trim(),
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
      },
    });

    return NextResponse.json({ success: true, persona });
  } catch (error) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Persona with this slug already exists' },
        { status: 400 },
      );
    }
    throw error;
  }
}
