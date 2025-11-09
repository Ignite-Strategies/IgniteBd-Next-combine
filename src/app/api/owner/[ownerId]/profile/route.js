import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request, { params }) {
  try {
    const { ownerId } = params || {};
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'Owner ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { firstName, lastName, email } = body ?? {};

    const name =
      firstName && lastName
        ? `${firstName} ${lastName}`.trim()
        : undefined;

    const owner = await prisma.owner.update({
      where: { id: ownerId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
      },
    });

    console.log('✅ Owner profile updated:', owner.id);

    return NextResponse.json({
      success: true,
      owner,
    });
  } catch (error) {
    console.error('❌ OwnerProfileSetup error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

