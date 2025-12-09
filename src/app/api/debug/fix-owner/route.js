import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/debug/fix-owner
 * Creates or updates Owner record for current Firebase user
 * 
 * Body: { email?, name? } (optional - will use Firebase user data if not provided)
 */
export async function POST(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    const body = await request.json().catch(() => ({}));
    
    // Check if Owner exists
    let owner = await prisma.owner.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (owner) {
      // Update existing owner
      owner = await prisma.owner.update({
        where: { id: owner.id },
        data: {
          email: body.email || firebaseUser.email || owner.email,
          name: body.name || firebaseUser.name || owner.name,
        },
        include: {
          managedCompanies: { select: { id: true, companyName: true } },
          ownedCompanies: { select: { id: true, companyName: true } },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Owner record updated',
        owner: {
          id: owner.id,
          firebaseId: owner.firebaseId,
          email: owner.email,
          name: owner.name,
          managedCompanies: owner.managedCompanies,
          ownedCompanies: owner.ownedCompanies,
        },
      });
    } else {
      // Create new owner
      owner = await prisma.owner.create({
        data: {
          firebaseId: firebaseUser.uid,
          email: body.email || firebaseUser.email || null,
          name: body.name || firebaseUser.name || null,
        },
        include: {
          managedCompanies: { select: { id: true, companyName: true } },
          ownedCompanies: { select: { id: true, companyName: true } },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Owner record created',
        owner: {
          id: owner.id,
          firebaseId: owner.firebaseId,
          email: owner.email,
          name: owner.name,
          managedCompanies: owner.managedCompanies,
          ownedCompanies: owner.ownedCompanies,
        },
      });
    }
  } catch (error) {
    console.error('❌ Fix owner error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 },
    );
  }
}

