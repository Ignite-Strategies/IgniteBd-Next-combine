import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

export async function GET(request, { params }) {
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
    // Get owner from Firebase token
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 },
      );
    }

    const template = await prisma.templates.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 },
      );
    }

    // Validate membership - owner must have access to template's companyHQ
    const { membership } = await resolveMembership(owner.id, template.companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this template' },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('❌ GetTemplate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get template',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
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
    // Get owner from Firebase token
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 },
      );
    }

    // Get existing template to validate access
    const existingTemplate = await prisma.templates.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 },
      );
    }

    // Validate membership - owner must have access to template's companyHQ
    const { membership } = await resolveMembership(owner.id, existingTemplate.companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this template' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { title, subject, body: bodyText } = body;

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (subject !== undefined) updateData.subject = subject.trim();
    if (bodyText !== undefined) updateData.body = bodyText.trim();

    const template = await prisma.templates.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('❌ UpdateTemplate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update template',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
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
    // Get owner from Firebase token
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 },
      );
    }

    // Get existing template to validate access
    const existingTemplate = await prisma.templates.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 },
      );
    }

    // Validate membership - owner must have access to template's companyHQ
    const { membership } = await resolveMembership(owner.id, existingTemplate.companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this template' },
        { status: 403 },
      );
    }

    await prisma.templates.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeleteTemplate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete template',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
