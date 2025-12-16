import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/contacts/create
 * Create a contact - focused only on contact creation
 * 
 * This route handles ONLY contact creation. Other concerns are handled downstream:
 * - Company association: Use PUT /api/contacts/[contactId] or separate company service
 * - Pipeline setup: Use PUT /api/contacts/[contactId] or pipeline service
 * - Buyer config: Use PUT /api/contacts/[contactId] 
 * 
 * Body:
 * - crmId (required) - CompanyHQId
 * - firstName, lastName, goesBy, email, phone, title
 * - companyId (optional) - Existing company ID to associate (no company creation here)
 * - howMet, notes (optional) - Basic metadata
 * 
 * Returns:
 * - contact: Created contact with basic relations
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      crmId,
      firstName,
      lastName,
      goesBy,
      email,
      phone,
      title,
      companyId, // Accept existing companyId only - no company creation
      howMet,
      notes,
    } = body ?? {};

    if (!crmId) {
      return NextResponse.json(
        { success: false, error: 'crmId (CompanyHQId) is required' },
        { status: 400 },
      );
    }

    // Validate companyHQ exists
    const companyHQ = await prisma.company_hqs.findUnique({
      where: { id: crmId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    // Validate companyId if provided (must exist)
    if (companyId) {
      const company = await prisma.companies.findUnique({
        where: { id: companyId },
      });
      if (!company || company.companyHQId !== crmId) {
        return NextResponse.json(
          { success: false, error: 'Company not found or does not belong to this tenant' },
          { status: 404 },
        );
      }
    }

    // Check for existing contact by email (if email provided)
    let contact;
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existingContact = await prisma.contact.findFirst({
        where: {
          crmId,
          email: normalizedEmail,
        },
      });

      if (existingContact) {
        // Update existing contact with provided fields (only update non-null values)
        const updateData = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (goesBy !== undefined) updateData.goesBy = goesBy;
        if (phone !== undefined) updateData.phone = phone;
        if (title !== undefined) updateData.title = title;
        if (companyId !== undefined) {
          updateData.companyId = companyId;
          updateData.contactCompanyId = companyId; // Legacy field
        }
        if (howMet !== undefined) updateData.howMet = howMet;
        if (notes !== undefined) updateData.notes = notes;

        contact = await prisma.contact.update({
          where: { id: existingContact.id },
          data: updateData,
        });

        console.log('✅ Contact updated:', contact.id);
      } else {
        // Create new contact
        contact = await prisma.contact.create({
          data: {
            crmId,
            firstName: firstName || null,
            lastName: lastName || null,
            goesBy: goesBy || null,
            email: normalizedEmail,
            phone: phone || null,
            title: title || null,
            companyId: companyId || null,
            contactCompanyId: companyId || null, // Legacy field
            howMet: howMet || null,
            notes: notes || null,
          },
        });

        console.log('✅ Contact created:', contact.id);
      }
    } else {
      // Create contact without email
      contact = await prisma.contact.create({
        data: {
          crmId,
          firstName: firstName || null,
          lastName: lastName || null,
          goesBy: goesBy || null,
          email: null,
          phone: phone || null,
          title: title || null,
          companyId: companyId || null,
          contactCompanyId: companyId || null, // Legacy field
          howMet: howMet || null,
          notes: notes || null,
        },
      });

      console.log('✅ Contact created (no email):', contact.id);
    }

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    console.error('❌ CreateContact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create contact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

