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
          outreach_personas: true, // Outreach persona relation
          relationship_contexts: true, // Relationship context relation
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
      
      // Ensure relationship_contexts relation is always an object (even if null) to prevent undefined errors
      if (contact && !contact.relationship_contexts) {
        contact.relationship_contexts = null;
      }

      // Hydrate introducedBy contact when introducedByContactId is set (simple string FK, no Prisma relation)
      if (contact?.introducedByContactId) {
        const introducer = await prisma.contact.findUnique({
          where: { id: contact.introducedByContactId },
          select: { id: true, firstName: true, lastName: true, goesBy: true, fullName: true, email: true },
        });
        contact.introducedByContact = introducer
          ? {
              id: introducer.id,
              displayName:
                introducer.goesBy ||
                [introducer.firstName, introducer.lastName].filter(Boolean).join(' ') ||
                introducer.fullName ||
                introducer.email ||
                'Unknown',
              email: introducer.email,
            }
          : null;
      } else {
        contact.introducedByContact = null;
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
      contactSummary,
      engagementSummary,
      pipeline,
      stage,
      outreachPersonaSlug,
      relationshipContext, // JSON field for relationship context
      introducedByContactId,
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
    // Use contactCompanyId as the FK (companyId is enrichment data only)
    if (companyId !== undefined) {
      // If companyId is provided, use it as contactCompanyId (the FK)
      updateData.contactCompanyId = companyId;
      // Don't set companyId - it's enrichment data only
    } else if (contactCompanyId !== undefined) {
      // If contactCompanyId is provided directly, use it
      updateData.contactCompanyId = contactCompanyId;
      // Don't set companyId - it's enrichment data only
    }
    if (buyerDecision !== undefined) updateData.buyerDecision = buyerDecision;
    if (howMet !== undefined) updateData.howMet = howMet;
    if (notes !== undefined) updateData.notes = notes;
    if (contactSummary !== undefined) updateData.contactSummary = contactSummary;
    if (engagementSummary !== undefined) updateData.engagementSummary = engagementSummary;
    if (outreachPersonaSlug !== undefined) {
      // Allow null to unset persona, or validate slug exists if provided
      if (outreachPersonaSlug === null || outreachPersonaSlug === '') {
        updateData.outreachPersonaSlug = null;
      } else {
        // Validate persona exists
        const persona = await prisma.outreach_personas.findUnique({
          where: { slug: outreachPersonaSlug },
        });
        if (!persona) {
          return NextResponse.json(
            { success: false, error: `Outreach persona with slug "${outreachPersonaSlug}" not found` },
            { status: 400 },
          );
        }
        updateData.outreachPersonaSlug = outreachPersonaSlug;
      }
    }
    if (introducedByContactId !== undefined) {
      // Allow null to clear, or validate contact exists if provided
      if (introducedByContactId === null || introducedByContactId === '') {
        updateData.introducedByContactId = null;
      } else {
        const introducer = await prisma.contact.findUnique({
          where: { id: introducedByContactId },
        });
        if (!introducer) {
          return NextResponse.json(
            { success: false, error: `Contact with id "${introducedByContactId}" not found` },
            { status: 400 },
          );
        }
        updateData.introducedByContactId = introducedByContactId;
      }
    }
    if (relationshipContext !== undefined) {
      // Parse JSON if provided as string, otherwise use as-is
      let parsedContext = relationshipContext;
      if (typeof relationshipContext === 'string') {
        try {
          parsedContext = JSON.parse(relationshipContext);
        } catch (e) {
          return NextResponse.json(
            { success: false, error: 'Invalid relationshipContext JSON format' },
            { status: 400 },
          );
        }
      }
      
      if (parsedContext === null) {
        // Delete relationship context if null (one per contact, keyed by contactId)
        await prisma.relationship_contexts.deleteMany({
          where: { contactId },
        });
      } else if (parsedContext && typeof parsedContext === 'object') {
        // Upsert relationship context record (one per contact, keyed by contactId)
        const contextData = {
          contactId,
          contextOfRelationship: parsedContext.contextOfRelationship || null,
          relationshipRecency: parsedContext.relationshipRecency || null,
          companyAwareness: parsedContext.companyAwareness || null,
          formerCompany: parsedContext.formerCompany || null,
        };
        await prisma.relationship_contexts.upsert({
          where: { contactId },
          update: contextData,
          create: contextData,
        });
      }
    }

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
        outreach_personas: true, // Outreach persona relation
        relationship_contexts: true, // Relationship context relation
      },
    });
    
    // Ensure relations are always objects (even if null) to prevent undefined errors
    if (updatedContact) {
      if (!updatedContact.companies) updatedContact.companies = null;
      if (!updatedContact.pipelines) updatedContact.pipelines = null;
      if (!updatedContact.relationship_contexts) updatedContact.relationship_contexts = null;
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

