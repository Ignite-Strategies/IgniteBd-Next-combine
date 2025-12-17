import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function GET(request, { params }) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Await params in Next.js 15+ App Router
    const { id } = await params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Presentation ID is required' },
        { status: 400 },
      );
    }

    // Ensure prisma.presentation exists
    if (!prisma.presentation) {
      console.error('❌ prisma.presentation is undefined');
      console.error('Available Prisma models:', Object.keys(prisma).filter(k => !k.startsWith('$')).join(', '));
      console.error('Prisma client type:', typeof prisma);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database client error - Prisma client needs regeneration',
          details: 'prisma.presentation model not found. Available models: ' + Object.keys(prisma).filter(k => !k.startsWith('$')).join(', ')
        },
        { status: 500 },
      );
    }

    const presentation = await prisma.presentation.findUnique({
      where: { id },
      include: {
        companyHQ: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!presentation) {
      return NextResponse.json(
        { success: false, error: 'Presentation not found' },
        { status: 404 },
      );
    }

    // Verify presentation belongs to owner's companyHQ
    if (presentation.companyHQ.ownerId !== owner.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 },
      );
    }

    // Remove companyHQ from response (internal check only)
    const { companyHQ, ...presentationData } = presentation;

    return NextResponse.json({
      success: true,
      presentation: presentationData,
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    console.error('❌ GetPresentation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get presentation',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Await params in Next.js 15+ App Router
    const { id } = await params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Presentation ID is required' },
        { status: 400 },
      );
    }

    // Ensure prisma.presentation exists
    if (!prisma.presentation) {
      console.error('❌ prisma.presentation is undefined');
      console.error('Available Prisma models:', Object.keys(prisma).filter(k => !k.startsWith('$')).join(', '));
      console.error('Prisma client type:', typeof prisma);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database client error - Prisma client needs regeneration',
          details: 'prisma.presentation model not found. Available models: ' + Object.keys(prisma).filter(k => !k.startsWith('$')).join(', ')
        },
        { status: 500 },
      );
    }

    // Verify presentation belongs to owner's companyHQ
    const presentation = await prisma.presentation.findUnique({
      where: { id },
      include: {
        companyHQ: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!presentation) {
      return NextResponse.json(
        { success: false, error: 'Presentation not found' },
        { status: 404 },
      );
    }

    if (presentation.companyHQ.ownerId !== owner.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      slides,
      published,
    } = body ?? {};

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (slides !== undefined) updateData.slides = slides;
    if (published !== undefined) {
      updateData.published = published;
      updateData.publishedAt = published ? new Date() : null;
    }

    const updatedPresentation = await prisma.presentation.update({
      where: { id },
      data: updateData,
    });

    console.log('✅ Presentation updated:', updatedPresentation.id);

    return NextResponse.json({
      success: true,
      presentation: updatedPresentation,
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    console.error('❌ UpdatePresentation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update presentation',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Await params in Next.js 15+ App Router
    const { id } = await params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Presentation ID is required' },
        { status: 400 },
      );
    }

    // Ensure prisma.presentation exists
    if (!prisma.presentation) {
      console.error('❌ prisma.presentation is undefined');
      console.error('Available Prisma models:', Object.keys(prisma).filter(k => !k.startsWith('$')).join(', '));
      console.error('Prisma client type:', typeof prisma);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database client error - Prisma client needs regeneration',
          details: 'prisma.presentation model not found. Available models: ' + Object.keys(prisma).filter(k => !k.startsWith('$')).join(', ')
        },
        { status: 500 },
      );
    }

    // Verify presentation belongs to owner's companyHQ
    const presentation = await prisma.presentation.findUnique({
      where: { id },
      include: {
        companyHQ: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!presentation) {
      return NextResponse.json(
        { success: false, error: 'Presentation not found' },
        { status: 404 },
      );
    }

    if (presentation.companyHQ.ownerId !== owner.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 },
      );
    }

    await prisma.presentation.delete({
      where: { id },
    });

    console.log('✅ Presentation deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'Presentation deleted successfully',
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    console.error('❌ DeletePresentation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete presentation',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
