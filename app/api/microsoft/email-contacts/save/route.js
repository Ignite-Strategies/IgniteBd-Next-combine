import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { resolveMembership } from '@/lib/membership';

/**
 * POST /api/microsoft/email-contacts/save
 * 
 * Save selected email contacts from preview to database
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
 * - For each item: create Contact with email, firstName, lastName
 * - No enrichment, no company/title/phone
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

    // Filter items by previewIds from previewItems array (no Redis needed)
    const itemsToSave = previewItems.filter(item => 
      previewIds.includes(item.previewId)
    );

    if (itemsToSave.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No matching contacts found in preview' },
        { status: 400 }
      );
    }

    // Create contacts
    let saved = 0;
    let skipped = 0;
    const errors = [];

    for (const item of itemsToSave) {
      try {
        const email = item.email.toLowerCase().trim();
        
        if (!email || !email.includes('@')) {
          skipped++;
          continue;
        }

        // Parse displayName into firstName/lastName (best effort)
        let firstName = null;
        let lastName = null;
        
        if (item.displayName) {
          const nameParts = item.displayName.trim().split(/\s+/);
          if (nameParts.length === 1) {
            firstName = nameParts[0];
          } else if (nameParts.length >= 2) {
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
          }
        }

        // Check if contact already exists (by email)
        const existing = await prisma.contact.findUnique({
          where: { email },
        });

        if (existing) {
          // Skip if already exists
          skipped++;
          continue;
        }

        // Create contact
        await prisma.contact.create({
          data: {
            crmId: companyHQId,
            email,
            firstName,
            lastName,
            // Explicitly ignore: company, title, phone, enrichment
          },
        });

        saved++;
      } catch (error) {
        // Handle unique constraint violation (race condition)
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
          skipped++;
        } else {
          errors.push({
            email: item.email,
            error: error.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      saved,
      skipped,
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
