import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/microsoft-graph/contacts
 * 
 * Server-side route to fetch Microsoft Graph contacts
 * Note: This requires the user's access token to be passed in the request
 * For client-side operations, use the useMicrosoftGraph hook directly
 */
export async function GET(request) {
  try {
    // Verify Firebase authentication
    await verifyFirebaseToken(request);

    // Get access token from request (should be passed by client)
    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get('accessToken');

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Microsoft Graph access token required' },
        { status: 400 }
      );
    }

    // Fetch contacts from Microsoft Graph
    const response = await fetch('https://graph.microsoft.com/v1.0/me/contacts', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch contacts from Microsoft Graph' },
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
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

