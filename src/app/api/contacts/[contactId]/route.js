import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { applyPipelineTriggers } from '@/lib/services/PipelineTriggerService.js';

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
    const { contactId } = params || {};
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        pipeline: true,
        company: true, // Universal company relation
        contactCompany: true, // Legacy relation for backward compatibility
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    console.error('❌ GetContact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch contact',
        details: error.message,
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
    const { contactId } = params || {};
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
        pipeline: true,
        company: true, // Universal company relation
        contactCompany: true, // Legacy relation for backward compatibility
      },
    });

    if (pipeline !== undefined || stage !== undefined) {
      const currentPipeline = await prisma.pipeline.findUnique({
        where: { contactId },
      });

      const newPipeline = pipeline !== undefined ? pipeline : currentPipeline?.pipeline || 'prospect';
      const newStage = stage !== undefined ? stage : currentPipeline?.stage || null;

      const convertedContact = await applyPipelineTriggers(contactId, newPipeline, newStage);
      if (convertedContact) {
        return NextResponse.json({
          success: true,
          contact: convertedContact,
          converted: true,
        });
      }

      const pipelineUpdate = {};
      if (pipeline !== undefined) pipelineUpdate.pipeline = pipeline;
      if (stage !== undefined) pipelineUpdate.stage = stage;

      await prisma.pipeline.upsert({
        where: { contactId },
        update: pipelineUpdate,
        create: {
          contactId,
          pipeline: pipeline || 'prospect',
          stage: stage || null,
        },
      });

      const updatedContact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          pipeline: true,
          company: true, // Universal company relation
          contactCompany: true, // Legacy relation for backward compatibility
        },
      });

      return NextResponse.json({
        success: true,
        contact: updatedContact,
      });
    }

    console.log('✅ Contact updated:', contact.id);

    return NextResponse.json({
      success: true,
      contact,
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
    const { contactId } = params || {};
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

