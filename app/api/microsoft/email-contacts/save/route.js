import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { resolveMembership } from '@/lib/membership';
import { mapPreviewItemToContact } from '@/lib/contactFromPreviewService';

/**
 * POST /api/microsoft/email-contacts/save
 * 
 * Save selected email contacts from preview to database
 * Uses contactFromPreviewService for mapping
 * 
 * Body:
 * {
 *   "previewIds": ["hash1", "hash2", ...],
 *   "previewItems": [{ previewId, email, displayName, ... }, ...], // Full preview items
 *   "companyHQId": "required"
 * }
 * 
 * Behavior:
 * - Filter items by previewIds from previewItems array
 * - Map each item using contactFromPreviewService
 * - Create Contact with email, firstName, lastName
 * - Skip if already exists
 * - Returns count of saved contacts
 */
export async function POST(request) {
  try {
    // Verify Firebase authentication
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
    const { previewIds, previewItems, companyHQId } = body;

    // Validate inputs
    if (!previewIds || !Array.isArray(previewIds) || previewIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'previewIds array is required' },
        { status: 400 }
      );
    }

    if (!previewItems || !Array.isArray(previewItems)) {
      return NextResponse.json(
        { success: false, error: 'previewItems array is required' },
        { status: 400 }
      );
    }

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 }
      );
    }

    // Membership guard
    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 }
      );
    }

    // Verify companyHQ exists
    const companyHQ = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 }
      );
    }

    // Filter items by previewIds from previewItems array
    const itemsToSave = previewItems.filter(item => 
      previewIds.includes(item.previewId)
    );

    if (itemsToSave.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No matching contacts found in preview' },
        { status: 400 }
      );
    }

    // Map preview items to contact data using service
    const contactsToSave = itemsToSave.map(item => mapPreviewItemToContact(item));

    // Create contacts
    let saved = 0;
    let skipped = 0;
    const errors = [];
    const savedContactIds = []; // Track IDs of successfully saved contacts

    for (const contactData of contactsToSave) {
      try {
        const email = contactData.email;
        
        if (!email || !email.includes('@')) {
          skipped++;
          continue;
        }

        // Check if contact already exists (by email AND crmId - matches schema @@unique([email, crmId]))
        const existing = await prisma.contact.findFirst({
          where: { 
            email: contactData.email,
            crmId: companyHQId 
          },
        });

        if (existing) {
          // Skip if already exists in this companyHQ
          skipped++;
          continue;
        }

        // Create contact
        const createdContact = await prisma.contact.create({
          data: {
            crmId: companyHQId,
            email: contactData.email,
            firstName: contactData.firstName,
            lastName: contactData.lastName,
            // Explicitly ignore: company, title, phone, enrichment
          },
        });

        saved++;
        savedContactIds.push(createdContact.id); // Store the ID
      } catch (error) {
        // Handle unique constraint violation (race condition)
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
          skipped++;
        } else {
          errors.push({
            email: contactData.email,
            error: error.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      saved,
      skipped,
      savedContactIds, // Return array of saved contact IDs
      errors: errors.length > 0 ? errors : undefined,
      message: `Saved ${saved} contact${saved !== 1 ? 's' : ''}`,
    });
  } catch (error) {
    console.error('❌ Microsoft email contacts save error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save contacts',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
