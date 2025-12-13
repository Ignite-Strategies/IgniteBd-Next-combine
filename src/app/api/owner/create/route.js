import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      firebaseId,
      email,
      firstName,
      lastName,
      photoURL,
    } = body ?? {};

    if (!firebaseId) {
      return NextResponse.json(
        { success: false, error: 'firebaseId is required' },
        { status: 400 },
      );
    }

    let owner = await prisma.owner.findUnique({
      where: { firebaseId },
    });

    if (!owner) {
      // Create with firstName and lastName (and legacy name for backward compatibility)
      const name = firstName && lastName
        ? `${firstName} ${lastName}`.trim()
        : firstName || email?.split('@')[0] || null;

      owner = await prisma.owner.create({
        data: {
          firebaseId,
          firstName: firstName || null,
          lastName: lastName || null,
          name: name || null, // Keep for backward compatibility
          email: email || null,
          photoURL: photoURL || null,
        },
      });
      console.log('✅ Created new owner:', owner.id);
    } else {
      console.log('✅ Found existing owner:', owner.id);
    }

    return NextResponse.json({
      success: true,
      owner,
    });
  } catch (error) {
    console.error('❌ OwnerCreate error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

