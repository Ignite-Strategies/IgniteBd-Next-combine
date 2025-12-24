import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/campaigns
 * Get all campaigns for the authenticated owner
 */
export async function GET(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json({ success: true, campaigns: [] });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const companyHQId = searchParams.get('companyHQId');

    const where = {
      owner_id: owner.id,
      ...(status && { status }),
      ...(companyHQId && { company_hq_id: companyHQId }),
    };

    const campaigns = await prisma.campaigns.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        email_activities: {
          select: {
            id: true,
            event: true,
            createdAt: true,
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      campaigns,
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get campaigns',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns
 * Create a new campaign
 */
export async function POST(request) {
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
    const {
      name,
      description,
      status = 'DRAFT',
      type = 'EMAIL',
      subject,
      preview_text,
      from_email,
      from_name,
      scheduled_for,
      company_hq_id,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Campaign name is required' },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaigns.create({
      data: {
        owner_id: owner.id,
        company_hq_id: company_hq_id || null,
        name,
        description: description || null,
        status,
        type,
        subject: subject || null,
        preview_text: preview_text || null,
        from_email: from_email || null,
        from_name: from_name || null,
        scheduled_for: scheduled_for ? new Date(scheduled_for) : null,
      },
    });

    return NextResponse.json({
      success: true,
      campaign,
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create campaign',
      },
      { status: 500 }
    );
  }
}

