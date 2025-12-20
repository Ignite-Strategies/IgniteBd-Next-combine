import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import CampaignPreviewService from '@/lib/services/campaignPreviewService';

/**
 * GET /api/campaigns/:campaignId/preview/email
 * Preview personalized email content
 * 
 * Query params:
 * - sequenceId: Optional sequence ID to preview specific sequence
 * - contactId: Optional contact ID to use for preview
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
    
    const sequenceId = searchParams.get('sequenceId') || null;
    const contactId = searchParams.get('contactId') || null;

    const preview = await CampaignPreviewService.previewEmailContent(
      campaignId,
      sequenceId,
      contactId
    );

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error) {
    console.error('Email preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate email preview',
      },
      { status: 500 }
    );
  }
}

