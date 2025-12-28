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
    const owner = await prisma.owners.findUnique({
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
    const { firstName, lastName, name, email, photoURL, teamSize, emailSignature } = body ?? {};

    // Build update data
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName || null;
    if (lastName !== undefined) updateData.lastName = lastName || null;
    // Support legacy name field for backward compatibility
    if (name !== undefined && firstName === undefined && lastName === undefined) {
      // If name is provided but not firstName/lastName, try to split it
      if (name) {
        const nameParts = name.trim().split(/\s+/);
        updateData.firstName = nameParts[0] || null;
        updateData.lastName = nameParts.slice(1).join(' ') || null;
      } else {
        updateData.firstName = null;
        updateData.lastName = null;
      }
    }
    if (email !== undefined) updateData.email = email || null;
    if (photoURL !== undefined) updateData.photoURL = photoURL || null;
    if (teamSize !== undefined) updateData.teamSize = teamSize || null;
    if (emailSignature !== undefined) updateData.emailSignature = emailSignature || null;

    // Update owner
    const updatedOwner = await prisma.owners.update({
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

