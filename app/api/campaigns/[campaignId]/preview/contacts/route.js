import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import CampaignPreviewService from '@/lib/services/campaignPreviewService';

/**
 * GET /api/campaigns/:campaignId/preview/contacts
 * Preview contact list - who will receive the emails
 * 
 * Query params:
 * - limit: Number of contacts to preview (default: 10)
 */
export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { campaignId } = params;
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const contactListPreview = await CampaignPreviewService.previewContactList(campaignId, limit);

    return NextResponse.json({
      success: true,
      contactListPreview,
    });
  } catch (error) {
    console.error('Contact list preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate contact list preview',
      },
      { status: 500 }
    );
  }
}

