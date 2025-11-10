import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function PUT(request, { params }) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    const { ownerId } = params || {};
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'Owner ID is required' },
        { status: 400 },
      );
    }

    // Verify owner exists and matches Firebase user
    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    if (owner.firebaseId !== firebaseUser.uid) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - You can only update your own profile' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { name, email, photoURL, teamSize } = body ?? {};

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name || null;
    if (email !== undefined) updateData.email = email || null;
    if (photoURL !== undefined) updateData.photoURL = photoURL || null;
    if (teamSize !== undefined) updateData.teamSize = teamSize || null;

    // Update owner
    const updatedOwner = await prisma.owner.update({
      where: { id: ownerId },
      data: updateData,
    });

    console.log('✅ Owner profile updated:', updatedOwner.id);

    return NextResponse.json({
      success: true,
      owner: updatedOwner,
    });
  } catch (error) {
    console.error('❌ OwnerProfileUpdate error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update profile' },
      { status: 500 },
    );
  }
}

