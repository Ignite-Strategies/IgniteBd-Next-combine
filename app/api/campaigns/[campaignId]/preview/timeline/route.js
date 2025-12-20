import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import CampaignPreviewService from '@/lib/services/campaignPreviewService';

/**
 * GET /api/campaigns/:campaignId/preview/timeline
 * Preview sequence timeline - when each email will be sent
 * 
 * Query params:
 * - startDate: Optional start date for timeline (ISO string, defaults to now)
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
    
    const startDateParam = searchParams.get('startDate');
    const startDate = startDateParam ? new Date(startDateParam) : new Date();

    const timeline = await CampaignPreviewService.previewTimeline(campaignId, startDate);

    return NextResponse.json({
      success: true,
      timeline,
    });
  } catch (error) {
    console.error('Timeline preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate timeline preview',
      },
      { status: 500 }
    );
  }
}

