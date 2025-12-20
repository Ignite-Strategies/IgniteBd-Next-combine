import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * Helper: Get owner's companyHQId from Firebase token and verify membership
 */
async function getOwnerCompanyHQId(firebaseUser) {
  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    include: {
      company_hqs_company_hqs_ownerIdToowners: {
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!owner) {
    throw new Error('Owner not found for Firebase user');
  }

  const companyHQId = owner.company_hqs_company_hqs_ownerIdToowners?.[0]?.id;
  
  if (!companyHQId) {
    throw new Error('Owner has no associated CompanyHQ');
  }

  // Membership guard
  const { membership } = await resolveMembership(owner.id, companyHQId);
  if (!membership) {
    throw new Error('Forbidden: No membership in this CompanyHQ');
  }

  return companyHQId;
}

/**
 * DELETE /api/contact-lists/[listId]
 * Delete a contact list (soft delete by setting isActive to false)
 * 
 * Returns:
 * - success: boolean
 */
export async function DELETE(request, { params }) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const companyHQId = await getOwnerCompanyHQId(firebaseUser);
    const { listId } = params;

    if (!listId) {
      return NextResponse.json(
        { success: false, error: 'List ID is required' },
        { status: 400 },
      );
    }

    // Verify the list belongs to the user's company
    const list = await prisma.contact_lists.findUnique({
      where: { id: listId },
    });

    if (!list) {
      return NextResponse.json(
        { success: false, error: 'Contact list not found' },
        { status: 404 },
      );
    }

    if (list.companyId !== companyHQId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You do not have access to this list' },
        { status: 403 },
      );
    }

    // Check if list is assigned to any active campaigns
    const activeCampaigns = await prisma.campaigns.findMany({
      where: {
        contactListId: listId,
        status: {
          in: ['active', 'draft'],
        },
      },
    });

    if (activeCampaigns.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot delete list: It is assigned to ${activeCampaigns.length} active campaign(s). Please unassign it first.` 
        },
        { status: 409 },
      );
    }

    // Soft delete by setting isActive to false
    await prisma.contact_lists.update({
      where: { id: listId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('❌ DeleteContactList error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete contact list',
      },
      { status: error.message.includes('Forbidden') ? 403 : 500 },
    );
  }
}

