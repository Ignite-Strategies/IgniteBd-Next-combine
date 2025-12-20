import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import CampaignPreviewService from '@/lib/services/campaignPreviewService';

/**
 * GET /api/campaigns/:campaignId/preview
 * Comprehensive preview of campaign (email content, timeline, contact list)
 * 
 * Query params:
 * - contactId: Optional contact ID to use for email preview
 * - startDate: Optional start date for timeline (ISO string)
 * - contactLimit: Number of contacts to preview (default: 5)
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
    
    const contactId = searchParams.get('contactId') || null;
    const startDateParam = searchParams.get('startDate');
    const startDate = startDateParam ? new Date(startDateParam) : new Date();
    const contactLimit = parseInt(searchParams.get('contactLimit') || '5', 10);

    const preview = await CampaignPreviewService.previewCampaign(campaignId, {
      contactId,
      startDate,
      contactLimit,
    });

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error) {
    console.error('Campaign preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate preview',
      },
      { status: 500 }
    );
  }
}

