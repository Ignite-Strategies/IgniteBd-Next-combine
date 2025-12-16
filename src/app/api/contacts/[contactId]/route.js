import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { applyPipelineTriggers } from '@/lib/services/PipelineTriggerService.js';
import { ensureContactPipeline, validatePipeline } from '@/lib/services/pipelineService';

export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Await params in Next.js 15+ App Router
    const resolvedParams = await params;
    const { contactId } = resolvedParams || {};
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    console.log('🔍 Fetching contact:', contactId);

    let contact;
    try {
      // Hydrate contact with ALL necessary relations
      contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          pipelines: true, // Pipeline relation
          companies: true, // Company relation via contactCompanyId
          contact_lists: true, // Contact lists relation
        },
      });
      
      // Ensure companies relation is always an object (even if null) to prevent undefined errors
      if (contact && !contact.companies) {
        contact.companies = null;
      }
      
      // Ensure pipelines relation is always an object (even if null) to prevent undefined errors
      if (contact && !contact.pipelines) {
        contact.pipelines = null;
      }
    } catch (prismaError) {
      console.error('❌ Prisma query error:', prismaError);
      console.error('❌ Prisma error name:', prismaError.name);
      console.error('❌ Prisma error message:', prismaError.message);
      console.error('❌ Prisma error code:', prismaError.code);
      console.error('❌ Prisma error stack:', prismaError.stack);
      throw prismaError;
    }

    if (!contact) {
      console.log('❌ Contact not found:', contactId);
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    console.log('✅ Contact found, serializing...');
    console.log('✅ Contact ID:', contact.id);
    console.log('✅ Contact has pipeline:', !!contact.pipeline);
    console.log('✅ Contact has companies:', !!contact.companies);
    console.log('✅ Contact has careerTimeline:', !!contact.careerTimeline);

    // Safely serialize the contact, handling JSON fields and potential circular references
    try {
      // Use JSON.parse/stringify to ensure clean serialization
      // This handles any potential circular references or non-serializable values
      const serializedContact = JSON.parse(JSON.stringify(contact, (key, value) => {
        // Handle Date objects
        if (value instanceof Date) {
          return value.toISOString();
        }
        // Handle BigInt (if any)
        if (typeof value === 'bigint') {
          return value.toString();
        }
        // Handle undefined (convert to null for JSON)
        if (value === undefined) {
          return null;
        }
        return value;
      }));

      return NextResponse.json({
        success: true,
        contact: serializedContact,
      });
    } catch (serializeError) {
      console.error('❌ Serialization error:', serializeError);
      console.error('❌ Serialization error stack:', serializeError.stack);
      console.error('❌ Contact keys:', Object.keys(contact || {}));
      
      // Try to return a minimal version without problematic fields
      try {
        const { careerTimeline, ...contactWithoutTimeline } = contact;
        const minimalContact = JSON.parse(JSON.stringify(contactWithoutTimeline, (key, value) => {
          if (value instanceof Date) return value.toISOString();
          if (typeof value === 'bigint') return value.toString();
          if (value === undefined) return null;
          return value;
        }));
        
        return NextResponse.json({
          success: true,
          contact: minimalContact,
          warning: 'Some fields may be missing due to serialization issues',
        });
      } catch (fallbackError) {
        console.error('❌ Fallback serialization also failed:', fallbackError);
        throw serializeError; // Re-throw original error
      }
    }
  } catch (error) {
    console.error('❌ GetContact error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch contact',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Await params in Next.js 15+ App Router
    const resolvedParams = await params;
    const { contactId } = resolvedParams || {};
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    const existingContact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!existingContact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      goesBy,
      email,
      phone,
      title,
      companyId,
      contactCompanyId, // Legacy field for backward compatibility
      buyerDecision,
      howMet,
      notes,
      pipeline,
      stage,
    } = body ?? {};

    // Validate pipeline and stage if provided
    if (pipeline !== undefined || stage !== undefined) {
      const finalPipeline = pipeline || 'prospect'; // Default if stage provided but pipeline not
      const validation = validatePipeline(finalPipeline, stage);
      if (!validation.isValid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 },
        );
      }
    }

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (goesBy !== undefined) updateData.goesBy = goesBy;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (title !== undefined) updateData.title = title;
    // Prefer companyId over contactCompanyId
    if (companyId !== undefined) {
      updateData.companyId = companyId;
      updateData.contactCompanyId = companyId; // Also set legacy field for backward compatibility
    } else if (contactCompanyId !== undefined) {
      updateData.companyId = contactCompanyId;
      updateData.contactCompanyId = contactCompanyId;
    }
    if (buyerDecision !== undefined) updateData.buyerDecision = buyerDecision;
    if (howMet !== undefined) updateData.howMet = howMet;
    if (notes !== undefined) updateData.notes = notes;

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
      include: {
        pipelines: true,
        companies: true, // Company relation via contactCompanyId
      },
    });

    // Pipeline updates should use the dedicated /api/contacts/[contactId]/pipeline route
    // Don't handle pipeline here - keep contact updates separate from pipeline updates
    if (pipeline !== undefined || stage !== undefined) {
      console.warn('⚠️ Pipeline update via contact PUT is deprecated. Use PUT /api/contacts/[contactId]/pipeline instead');
      // Still support it for backward compatibility, but log warning
      const currentPipeline = await prisma.pipelines.findUnique({
        where: { contactId },
      });

      const newPipeline = pipeline !== undefined ? pipeline : currentPipeline?.pipeline || 'prospect';
      const newStage = stage !== undefined ? stage : currentPipeline?.stage || 'interest';

      // Check for pipeline conversion triggers (prospect → client)
      const convertedContact = await applyPipelineTriggers(contactId, newPipeline, newStage);
      if (convertedContact) {
        return NextResponse.json({
          success: true,
          contact: convertedContact,
          converted: true,
        });
      }

      // Update pipeline
      await ensureContactPipeline(contactId, {
        pipeline: newPipeline,
        stage: newStage,
      });
    }

    // Re-fetch contact with ALL relations to ensure full hydration
    const updatedContact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        pipelines: true,
        companies: true,
        contact_lists: true,
      },
    });
    
    // Ensure relations are always objects (even if null) to prevent undefined errors
    if (updatedContact) {
      if (!updatedContact.companies) updatedContact.companies = null;
      if (!updatedContact.pipelines) updatedContact.pipelines = null;
    }

    console.log('✅ Contact updated:', updatedContact.id);

    return NextResponse.json({
      success: true,
      contact: updatedContact,
    });
  } catch (error) {
    console.error('❌ UpdateContact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update contact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Await params in Next.js 15+ App Router
    const resolvedParams = await params;
    const { contactId } = resolvedParams || {};
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    await prisma.contact.delete({
      where: { id: contactId },
    });

    console.log('✅ Contact deleted:', contactId);

    return NextResponse.json({
      success: true,
      message: 'Contact deleted',
    });
  } catch (error) {
    console.error('❌ DeleteContact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete contact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

