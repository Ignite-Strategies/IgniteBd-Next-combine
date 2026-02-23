import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/relationship-contexts
 * Get all relationship contexts
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contexts = await prisma.relationship_contexts.findMany({
      orderBy: [
        { contextOfRelationship: 'asc' },
        { relationshipRecency: 'asc' },
        { companyAwareness: 'asc' },
      ],
    });

    return NextResponse.json({ success: true, contexts });
  } catch (error) {
    console.error('❌ Relationship contexts GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch relationship contexts' },
      { status: 500 },
    );
  }
}
