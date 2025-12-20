import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import CampaignPreviewService from '@/lib/services/campaignPreviewService';

/**
 * GET /api/campaigns/:campaignId/preview/validate
 * Validate campaign before sending
 * Returns validation errors and warnings
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

    const validation = await CampaignPreviewService.validateCampaign(campaignId);

    return NextResponse.json({
      success: true,
      validation,
    });
  } catch (error) {
    console.error('Campaign validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to validate campaign',
      },
      { status: 500 }
    );
  }
}

