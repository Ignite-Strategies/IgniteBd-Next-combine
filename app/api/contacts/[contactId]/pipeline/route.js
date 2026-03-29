import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { applyContactPipelineUpdate } from '@/lib/services/contactPipelineApply';

/**
 * PUT /api/contacts/[contactId]/pipeline
 * Create or update pipeline for a contact
 * 
 * Body:
 * - pipeline (required) - "unassigned" | "connector" | "prospect" | "client" | "collaborator" | "institution"
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

    const result = await applyContactPipelineUpdate(contactId, { pipeline, stage });
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    if (result.converted) {
      return NextResponse.json({
        success: true,
        contact: result.contact,
        converted: true,
        pipeline: result.pipeline,
      });
    }

    return NextResponse.json({
      success: true,
      pipeline: result.pipeline,
      contact: result.contact,
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

