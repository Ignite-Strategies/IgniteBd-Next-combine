import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * Helper: Get owner and verify membership for companyHQId
 * companyHQId should come from request (query param or body), not from old FK
 */
async function getOwnerAndVerifyMembership(firebaseUser, companyHQId) {
  if (!companyHQId) {
    throw new Error('companyHQId is required');
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });

  if (!owner) {
    throw new Error('Owner not found for Firebase user');
  }

  // Membership guard - verify owner has access to this CompanyHQ
  const { membership } = await resolveMembership(owner.id, companyHQId);
  if (!membership) {
    throw new Error('Forbidden: No membership in this CompanyHQ');
  }

  return { owner, companyHQId };
}

/**
 * GET /api/contact-lists
 * Get all contact lists for the authenticated user's companyHQ
 * 
 * Returns:
 * - success: boolean
 * - lists: array of contact lists
 */
export async function GET(request) {
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
    // Get companyHQId from query params (frontend should send this from localStorage)
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');
    
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    await getOwnerAndVerifyMembership(firebaseUser, companyHQId);

    const lists = await prisma.contact_lists.findMany({
      where: {
        companyId: companyHQId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            contacts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format the response to match frontend expectations
    const formattedLists = lists.map((list) => ({
      id: list.id,
      name: list.name,
      description: list.description,
      type: list.type || 'Custom',
      totalContacts: list._count.contacts,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      lists: formattedLists,
    });
  } catch (error) {
    console.error('❌ GetContactLists error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch contact lists',
      },
      { status: error.message.includes('Forbidden') ? 403 : 500 },
    );
  }
}

/**
 * POST /api/contact-lists
 * Create a new contact list
 * 
 * Body:
 * - name (required)
 * - description (optional)
 * - type (optional, defaults to "static")
 * - filters (optional, JSON for smart lists)
 * 
 * Returns:
 * - success: boolean
 * - list: created contact list
 */
export async function POST(request) {
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
    const body = await request.json();
    const companyHQId = body.companyHQId;
    
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required in request body' },
        { status: 400 },
      );
    }

    await getOwnerAndVerifyMembership(firebaseUser, companyHQId);
    const { name, description, type, filters, contactIds } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'List name is required' },
        { status: 400 },
      );
    }

    // Check if list with same name already exists for this company
    const existingList = await prisma.contact_lists.findUnique({
      where: {
        companyId_name: {
          companyId: companyHQId,
          name: name.trim(),
        },
      },
    });

    if (existingList) {
      return NextResponse.json(
        { success: false, error: 'A list with this name already exists' },
        { status: 409 },
      );
    }

    // Create the list
    const listId = `cl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newList = await prisma.contact_lists.create({
      data: {
        id: listId,
        companyId: companyHQId,
        name: name.trim(),
        description: description?.trim() || null,
        type: type || 'static',
        filters: filters || null,
        totalContacts: 0,
        isActive: true,
      },
    });

    // Associate contacts with the list if contactIds provided
    let contactCount = 0;
    if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
      // Update contacts to set their contactListId
      // Note: This is a one-to-many relationship, so each contact can only be in one list
      // If a contact is already in another list, we'll move them to this new list
      const updateResult = await prisma.contact.updateMany({
        where: {
          id: { in: contactIds },
          crmId: companyHQId, // Ensure contacts belong to this company
        },
        data: {
          contactListId: listId,
        },
      });
      contactCount = updateResult.count;

      // Update the list's totalContacts count
      await prisma.contact_lists.update({
        where: { id: listId },
        data: { totalContacts: contactCount },
      });
    }

    // Fetch the list with updated count
    const updatedList = await prisma.contact_lists.findUnique({
      where: { id: listId },
      include: {
        _count: {
          select: {
            contacts: true,
          },
        },
      },
    });

    // Format the response
    const formattedList = {
      id: updatedList.id,
      name: updatedList.name,
      description: updatedList.description,
      type: updatedList.type,
      totalContacts: updatedList._count.contacts,
      createdAt: updatedList.createdAt.toISOString(),
      updatedAt: updatedList.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      list: formattedList,
    });
  } catch (error) {
    console.error('❌ CreateContactList error:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A list with this name already exists' },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create contact list',
      },
      { status: error.message.includes('Forbidden') ? 403 : 500 },
    );
  }
}

