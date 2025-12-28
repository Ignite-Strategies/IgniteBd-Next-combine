import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership, resolveAllMemberships } from '@/lib/membership';

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
 * Simple route similar to templates - accepts ownerId from useOwner hook
 * 
 * Body:
 * - ownerId (required) - from useOwner hook
 * - title (required) - list name
 * - description (optional)
 * - companyHQId (optional) - if not provided, uses owner's primary companyHQ
 * - contactIds (optional) - array of contact IDs to add to the list
 * - filters (optional) - filter criteria for smart lists (e.g., { filterType: "stage", pipeline: "prospect" })
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
    const { ownerId, title, description, companyHQId, contactIds, filters } = body;

    // Validate required fields
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'ownerId is required' },
        { status: 400 },
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 },
      );
    }

    // Resolve companyHQId from owner if not provided
    let resolvedCompanyHQId = companyHQId;
    if (!resolvedCompanyHQId) {
      // Get owner's primary companyHQ from memberships (first one, typically the primary)
      const memberships = await resolveAllMemberships(ownerId);
      if (!memberships || memberships.length === 0) {
        return NextResponse.json(
          { success: false, error: 'companyHQId is required. Provide it in the request body or ensure owner has a companyHQ membership.' },
          { status: 400 },
        );
      }
      // Use the first membership (typically the primary/oldest)
      // Membership uses companyHqId (camelCase) field name
      resolvedCompanyHQId = memberships[0].companyHqId;
    }

    // Verify membership for the companyHQ
    await getOwnerAndVerifyMembership(firebaseUser, resolvedCompanyHQId);

    // Check if list with same name already exists for this company
    const existingList = await prisma.contact_lists.findUnique({
      where: {
        companyId_name: {
          companyId: resolvedCompanyHQId,
          name: title.trim(),
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
        companyId: resolvedCompanyHQId,
        name: title.trim(), // title -> name in schema
        description: description?.trim() || null,
        type: 'static', // Default to static for simple lists
        filters: filters || null, // Store filter criteria (no campaign logic here)
        totalContacts: 0,
        isActive: true,
      },
    });

    // Associate contacts with the list if contactIds provided
    let contactCount = 0;
    if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
      // First, verify all contacts belong to the same companyHQ (for security/tenant isolation)
      const contactsToCheck = await prisma.contact.findMany({
        where: {
          id: { in: contactIds },
        },
        select: {
          id: true,
          crmId: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      // Check if any contacts have different crmId (belong to different companyHQ)
      const mismatchedContacts = contactsToCheck.filter(
        (contact) => contact.crmId !== resolvedCompanyHQId
      );

      if (mismatchedContacts.length > 0) {
        console.warn(`⚠️ Some contacts belong to different companyHQ:`, mismatchedContacts.map(c => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
          crmId: c.crmId,
          expectedCrmId: resolvedCompanyHQId
        })));
        
        // Return error with details about which contacts couldn't be added
        return NextResponse.json(
          {
            success: false,
            error: `${mismatchedContacts.length} contact(s) belong to a different company and cannot be added to this list.`,
            details: {
              mismatchedContacts: mismatchedContacts.map(c => ({
                name: `${c.firstName} ${c.lastName}`,
                email: c.email,
                crmId: c.crmId,
              })),
              expectedCrmId: resolvedCompanyHQId,
            },
          },
          { status: 400 }
        );
      }

      // Update contacts to set their contactListId
      // Note: This is a one-to-many relationship, so each contact can only be in one list
      // If a contact is already in another list, we'll move them to this new list
      const updateResult = await prisma.contact.updateMany({
        where: {
          id: { in: contactIds },
          crmId: resolvedCompanyHQId, // Ensure contacts belong to this companyHQ
        },
        data: {
          contactListId: listId,
        },
      });
      contactCount = updateResult.count;
      
      // Log if not all contacts were updated (for debugging)
      if (contactCount < contactIds.length) {
        console.warn(`⚠️ Only ${contactCount} of ${contactIds.length} contacts were updated. Expected all contacts to match crmId.`);
      }

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

    // Format the response (similar to template response)
    const formattedList = {
      id: updatedList.id,
      ownerId, // Include ownerId in response
      title: updatedList.name, // Map name -> title for consistency
      name: updatedList.name, // Also include name for backward compatibility
      description: updatedList.description,
      type: updatedList.type,
      totalContacts: updatedList._count.contacts,
      companyHQId: resolvedCompanyHQId,
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

