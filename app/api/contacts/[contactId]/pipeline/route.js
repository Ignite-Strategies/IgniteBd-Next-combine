import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { validatePipeline } from '@/lib/services/pipelineService';
import { applyPipelineTriggers } from '@/lib/services/PipelineTriggerService';

/**
 * PUT /api/contacts/[contactId]/pipeline
 * Create or update pipeline for a contact
 * 
 * Body:
 * - pipeline (required) - "unassigned" | "prospect" | "client" | "collaborator" | "institution"
 * - stage (optional for "unassigned", required for others) - Stage within the pipeline
 * 
 * Returns:
 * - success: boolean
 * - pipeline: Pipeline record
 */
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

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { pipeline, stage } = body ?? {};

    // Validate required fields
    if (!pipeline) {
      return NextResponse.json(
        { success: false, error: 'pipeline is required' },
        { status: 400 },
      );
    }

    // Stage is optional for 'unassigned' pipeline, required for others
    if (pipeline !== 'unassigned' && !stage) {
      return NextResponse.json(
        { success: false, error: 'stage is required for this pipeline' },
        { status: 400 },
      );
    }

    // Validate pipeline and stage values
    // For unassigned, stage can be null/empty
    const stageToValidate = pipeline === 'unassigned' ? null : stage;
    const validation = validatePipeline(pipeline, stageToValidate);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 },
      );
    }

    // Check if pipeline exists
    const existingPipeline = await prisma.pipelines.findUnique({
      where: { contactId },
    });

    // Check for pipeline conversion triggers (prospect → client)
    const convertedContact = await applyPipelineTriggers(contactId, pipeline, stage);
    if (convertedContact) {
      return NextResponse.json({
        success: true,
        contact: convertedContact,
        converted: true,
        pipeline: convertedContact.pipelines || convertedContact.pipeline,
      });
    }

    // Generate UUID for new pipeline
    const { randomUUID } = await import('crypto');
    const pipelineId = existingPipeline?.id || randomUUID();

    // Upsert pipeline
    // For unassigned pipeline, stage should be null
    const stageValue = pipeline === 'unassigned' ? null : stage;
    
    const updatedPipeline = await prisma.pipelines.upsert({
      where: { contactId },
      update: {
        pipeline,
        stage: stageValue,
        updatedAt: new Date(),
      },
      create: {
        id: pipelineId,
        contactId,
        pipeline,
        stage: stageValue,
        updatedAt: new Date(),
      },
    });

    // Re-fetch contact with pipeline to return complete data
    const contactWithPipeline = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        pipelines: true,
        companies: true,
      },
    });

    return NextResponse.json({
      success: true,
      pipeline: updatedPipeline,
      contact: contactWithPipeline,
    });
  } catch (error) {
    console.error('❌ UpdatePipeline error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update pipeline',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

