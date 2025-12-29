import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/email-signatures/[id]
 * 
 * Update an email signature
 * 
 * Body:
 * {
 *   "name": "Updated Name" (optional),
 *   "content": "<p>Updated content</p>" (optional),
 *   "is_default": true (optional)
 * }
 */
export async function PUT(request, { params }) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Signature ID is required' },
        { status: 400 }
      );
    }

    // Verify signature exists and belongs to owner
    const existingSignature = await prisma.email_signatures.findFirst({
      where: {
        id,
        owner_id: owner.id,
      },
    });

    if (!existingSignature) {
      return NextResponse.json(
        { success: false, error: 'Signature not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, content, is_default } = body;

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (content !== undefined) updateData.content = content;
    if (is_default !== undefined) {
      updateData.is_default = is_default;
      // If setting as default, unset other defaults
      if (is_default) {
        await prisma.email_signatures.updateMany({
          where: {
            owner_id: owner.id,
            is_default: true,
            id: { not: id }, // Exclude current signature
          },
          data: { is_default: false },
        });
      }
    }

    // Update signature
    const signature = await prisma.email_signatures.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        content: true,
        is_default: true,
        created_at: true,
        updated_at: true,
      },
    });

    console.log('✅ Email signature updated:', signature.id);

    return NextResponse.json({
      success: true,
      signature,
    });
  } catch (error) {
    console.error('❌ Error updating email signature:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update signature' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/email-signatures/[id]
 * 
 * Delete an email signature
 */
export async function DELETE(request, { params }) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Signature ID is required' },
        { status: 400 }
      );
    }

    // Verify signature exists and belongs to owner
    const existingSignature = await prisma.email_signatures.findFirst({
      where: {
        id,
        owner_id: owner.id,
      },
    });

    if (!existingSignature) {
      return NextResponse.json(
        { success: false, error: 'Signature not found' },
        { status: 404 }
      );
    }

    // Delete signature
    await prisma.email_signatures.delete({
      where: { id },
    });

    console.log('✅ Email signature deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'Signature deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting email signature:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete signature' },
      { status: 500 }
    );
  }
}

