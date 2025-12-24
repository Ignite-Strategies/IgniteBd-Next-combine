import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/campaigns/[campaignId]
 * Get a specific campaign with analytics
 */
export async function GET(request, { params }) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    const campaign = await prisma.campaigns.findFirst({
      where: {
        id: params.campaignId,
        owner_id: owner.id,
      },
      include: {
        contact_lists: {
          select: {
            id: true,
            name: true,
            description: true,
            totalContacts: true,
          },
        },
        outreach_template: {
          include: {
            template_bases: {
              select: {
                id: true,
                title: true,
                relationship: true,
                typeOfPerson: true,
                whyReachingOut: true,
              },
            },
          },
        },
        email_activities: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Calculate real-time metrics
    const totalSent = campaign.email_activities.length;
    const delivered = campaign.email_activities.filter(
      (ea) => ea.event === 'delivered' || ['opened', 'clicked', 'replied'].includes(ea.event)
    ).length;
    const opened = campaign.email_activities.filter(
      (ea) => ea.event === 'opened' || ['clicked', 'replied'].includes(ea.event)
    ).length;
    const clicked = campaign.email_activities.filter(
      (ea) => ea.event === 'clicked' || ea.event === 'replied'
    ).length;
    const replied = campaign.email_activities.filter(
      (ea) => ea.event === 'replied'
    ).length;

    const metrics = {
      total_sent: totalSent,
      emails_delivered: delivered,
      emails_opened: opened,
      emails_clicked: clicked,
      emails_replied: replied,
      open_rate: totalSent > 0 ? (opened / totalSent) * 100 : 0,
      click_rate: totalSent > 0 ? (clicked / totalSent) * 100 : 0,
      reply_rate: totalSent > 0 ? (replied / totalSent) * 100 : 0,
    };

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        metrics,
      },
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get campaign',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/campaigns/[campaignId]
 * Update a campaign
 */
export async function PATCH(request, { params }) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updateData = {};

    // Allow updating these fields
    const allowedFields = [
      'name',
      'description',
      'status',
      'contact_list_id',
      'template_id',
      'subject',
      'preview_text',
      'body',
      'from_email',
      'from_name',
      'scheduled_for',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'scheduled_for' && body[field]) {
          updateData[field] = new Date(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const campaign = await prisma.campaigns.update({
      where: {
        id: params.campaignId,
        owner_id: owner.id,
      },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      campaign,
    });
  } catch (error) {
    console.error('Update campaign error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update campaign',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/[campaignId]
 * Delete a campaign (only if in DRAFT status)
 */
export async function DELETE(request, { params }) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    const campaign = await prisma.campaigns.findFirst({
      where: {
        id: params.campaignId,
        owner_id: owner.id,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (campaign.status !== 'DRAFT') {
      return NextResponse.json(
        { success: false, error: 'Only draft campaigns can be deleted' },
        { status: 400 }
      );
    }

    await prisma.campaigns.delete({
      where: { id: params.campaignId },
    });

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted',
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete campaign',
      },
      { status: 500 }
    );
  }
}

