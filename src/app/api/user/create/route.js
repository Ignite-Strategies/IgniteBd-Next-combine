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
      const nameParts = [firstName, lastName].filter(Boolean);
      const name = nameParts.length ? nameParts.join(' ') : firstName || null;

      owner = await prisma.owner.create({
        data: {
          firebaseId,
          name: name || null,
          email: email || null,
          photoURL: photoURL || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: owner,
    });
  } catch (error) {
    console.error('❌ user/create error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

