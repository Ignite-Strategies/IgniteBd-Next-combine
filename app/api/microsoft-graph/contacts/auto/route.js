import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken } from '@/lib/microsoftGraphClient';

/**
 * GET /api/microsoft-graph/contacts/auto
 * 
 * Automatically fetch Microsoft Graph contacts using the owner's stored access token
 * This route handles token refresh automatically
 */
export async function GET(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    // Get Owner record by firebaseId
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
        microsoftAccessToken: true,
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    // Check if Microsoft is connected (using MicrosoftAccount model)
    const { isMicrosoftConnected } = await import('@/lib/microsoftGraphClient');
    const connected = await isMicrosoftConnected(owner.id);
    if (!connected) {
      return NextResponse.json(
        { success: false, error: 'Microsoft account not connected' },
        { status: 400 }
      );
    }

    // Get valid access token (handles refresh automatically)
    // Note: getValidAccessToken expects owner.id (database ID)
    const accessToken = await getValidAccessToken(owner.id);

    // Fetch contacts from Microsoft Graph
    const response = await fetch('https://graph.microsoft.com/v1.0/me/contacts?$top=1000', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { success: false, error: error.error?.message || 'Failed to fetch contacts from Microsoft Graph' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      contacts: data.value || [],
      count: data.value?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching Microsoft Graph contacts:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}
