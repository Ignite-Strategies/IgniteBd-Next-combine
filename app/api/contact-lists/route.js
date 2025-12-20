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
    const companyHQId = await getOwnerCompanyHQId(firebaseUser);

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
    const companyHQId = await getOwnerCompanyHQId(firebaseUser);
    const body = await request.json();
    const { name, description, type, filters } = body;

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
    const newList = await prisma.contact_lists.create({
      data: {
        id: `cl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId: companyHQId,
        name: name.trim(),
        description: description?.trim() || null,
        type: type || 'static',
        filters: filters || null,
        totalContacts: 0,
        isActive: true,
      },
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
      id: newList.id,
      name: newList.name,
      description: newList.description,
      type: newList.type,
      totalContacts: newList._count.contacts,
      createdAt: newList.createdAt.toISOString(),
      updatedAt: newList.updatedAt.toISOString(),
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

