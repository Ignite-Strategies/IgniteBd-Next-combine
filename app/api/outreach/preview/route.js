import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { readPayload } from '@/lib/redis';

/**
 * GET /api/outreach/preview?requestId=xxx
 * 
 * Step 2: Preview
 * 
 * Flow:
 * 1. Auth → verify Firebase token
 * 2. Fetch owner → get owner record
 * 3. Read payload from Redis → get EXACT payload
 * 4. Return payload → UI renders exactly what will be sent
 * 
 * No mutation, no rebuilding, no transformation.
 * Preview === what will be sent.
 */
export async function GET(request) {
  console.log('👁️  GET /api/outreach/preview - Request received');
  
  try {
    // Step 1: Auth
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Step 2: Fetch owner
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

    // Get requestId from query params
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'requestId is required' },
        { status: 400 }
      );
    }

    // Step 3: Read payload from Redis
    const payload = await readPayload(owner.id, requestId);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Payload not found or expired' },
        { status: 404 }
      );
    }

    // Step 4: Normalize payload for user display (don't show raw code structure)
    // Extract readable fields from payload blob
    const normalizedPreview = {
      from: {
        email: payload.from?.email || '',
        name: payload.from?.name || '',
      },
      to: payload.personalizations?.[0]?.to?.[0]?.email || '',
      subject: payload.personalizations?.[0]?.subject || '',
      body: payload.content?.[0]?.value || '',
      // Include custom_args if present (for reference, not shown in UI)
      customArgs: payload.personalizations?.[0]?.custom_args || {},
    };

    console.log('✅ Preview payload (normalized for display):', JSON.stringify(normalizedPreview, null, 2));
    
    return NextResponse.json({
      success: true,
      preview: normalizedPreview, // Normalized for user display
      payload, // Raw payload blob (for debugging/reference)
    });
  } catch (error) {
    console.error('❌ Error reading preview:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to read preview',
      },
      { status: 500 }
    );
  }
}

