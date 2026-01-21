import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/owners/list
 * 
 * List all owners (SuperAdmin only)
 * Used for sender assignment dropdown/search
 */
export async function GET(request) {
  try {
    // Require SuperAdmin
    const firebaseUser = await verifyFirebaseToken(request);
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      include: { superAdmin: true },
    });

    if (!owner || !owner.superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - SuperAdmin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // Get all owners, optionally filtered by search
    const owners = await prisma.owners.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
      },
      take: 50, // Limit results
      orderBy: { email: 'asc' },
    });

    return NextResponse.json({
      success: true,
      owners: owners.map(o => ({
        id: o.id,
        email: o.email,
        name: o.name || `${o.firstName || ''} ${o.lastName || ''}`.trim() || o.email,
        hasVerifiedSender: !!o.sendgridVerifiedEmail,
        verifiedSenderEmail: o.sendgridVerifiedEmail,
      })),
    });
  } catch (error) {
    console.error('List owners error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list owners',
      },
      { status: 500 }
    );
  }
}





