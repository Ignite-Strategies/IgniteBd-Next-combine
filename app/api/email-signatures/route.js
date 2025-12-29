import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/email-signatures
 * 
 * List all email signatures for the authenticated owner
 */
export async function GET(request) {
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

    // Fetch all signatures for this owner
    const signatures = await prisma.email_signatures.findMany({
      where: { owner_id: owner.id },
      orderBy: [
        { is_default: 'desc' }, // Default first
        { created_at: 'desc' },  // Then newest first
      ],
      select: {
        id: true,
        name: true,
        content: true,
        is_default: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({
      success: true,
      signatures,
    });
  } catch (error) {
    console.error('❌ Error fetching email signatures:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch signatures' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/email-signatures
 * 
 * Create a new email signature for the authenticated owner
 * 
 * Body:
 * {
 *   "name": "Default",
 *   "content": "<p>HTML signature content</p>",
 *   "is_default": false (optional, defaults to false)
 * }
 */
export async function POST(request) {
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

    const body = await request.json();
    const { name, content, is_default = false } = body;

    if (!name || !content) {
      return NextResponse.json(
        { success: false, error: 'name and content are required' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await prisma.email_signatures.updateMany({
        where: { owner_id: owner.id, is_default: true },
        data: { is_default: false },
      });
    }

    // Create signature
    const signature = await prisma.email_signatures.create({
      data: {
        owner_id: owner.id,
        name,
        content,
        is_default,
      },
      select: {
        id: true,
        name: true,
        content: true,
        is_default: true,
        created_at: true,
        updated_at: true,
      },
    });

    console.log('✅ Email signature created:', signature.id);

    return NextResponse.json({
      success: true,
      signature,
    });
  } catch (error) {
    console.error('❌ Error creating email signature:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create signature' },
      { status: 500 }
    );
  }
}

