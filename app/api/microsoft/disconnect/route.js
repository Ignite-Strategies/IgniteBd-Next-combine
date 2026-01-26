import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/microsoft/disconnect
 * DELETE /api/microsoft/disconnect (legacy support)
 * 
 * Disconnect Microsoft OAuth connection for the current user
 * 
 * Returns:
 * {
 *   "disconnected": true
 * }
 */
export async function PATCH(request) {
  return handleDisconnect(request);
}

export async function DELETE(request) {
  return handleDisconnect(request);
}

async function handleDisconnect(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    // Get Owner record
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { disconnected: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    // Delete MicrosoftAccount record (new model)
    // This removes the entire MicrosoftAccount, effectively disconnecting
    await prisma.microsoftAccount.delete({
      where: { ownerId: owner.id },
    });

    console.log('✅ Microsoft OAuth disconnected for owner:', owner.id);

    return NextResponse.json({
      disconnected: true,
    });
  } catch (error) {
    console.error('Microsoft disconnect error:', error);
    
    // If record doesn't exist, that's okay
    if (error.code === 'P2025') {
      return NextResponse.json({
        disconnected: true,
      });
    }

    return NextResponse.json(
      { disconnected: false, error: error.message || 'Failed to disconnect Microsoft account' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

