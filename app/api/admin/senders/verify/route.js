import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { listSenders } from '@/lib/sendgridSendersApi';

/**
 * POST /api/admin/senders/verify
 * 
 * Step 1: Look up and verify sender in SendGrid
 * SuperAdmin only - checks if sender exists and is verified
 * 
 * Body:
 * {
 *   "email": "user@example.com"
 * }
 */
export async function POST(request) {
  try {
    // Require SuperAdmin - check manually to avoid redirect
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
    
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get all senders from SendGrid
    const sendersResult = await listSenders();
    const allSenders = sendersResult.senders || [];
    
    // Find sender by email
    const sender = allSenders.find(
      (s) => (s.from?.email || s.email)?.toLowerCase() === email.toLowerCase()
    );

    if (!sender) {
      return NextResponse.json({
        success: false,
        error: 'Sender not found in SendGrid',
        verified: false,
      });
    }

    // Check verification status
    const isVerified = sender.verified === true;

    return NextResponse.json({
      success: true,
      verified: isVerified,
      sender: {
        id: sender.id,
        email: sender.from?.email || sender.email,
        name: sender.from?.name || sender.name,
        verified: isVerified,
      },
    });
  } catch (error) {
    console.error('Verify sender error:', error);
    
    if (error.message?.includes('Unauthorized') || error.message?.includes('token')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to verify sender',
      },
      { status: 500 }
    );
  }
}

