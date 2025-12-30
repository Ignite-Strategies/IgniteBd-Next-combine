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

    // FIRST: Try to find by firebaseId (primary lookup)
    let owner = await prisma.owners.findUnique({
      where: { firebaseId },
    });

    // SECOND: If not found by firebaseId, try to find by email (fallback for account linking)
    if (!owner && email) {
      console.log('🔍 OwnerCreate: Not found by firebaseId, trying email lookup:', email);
      owner = await prisma.owners.findFirst({
        where: { 
          email: email,
        },
      });
      
      // If found by email but firebaseId is different, update it (account linking)
      if (owner && owner.firebaseId !== firebaseId) {
        console.log('🔗 OwnerCreate: Linking account - updating firebaseId for existing owner:', owner.id);
        owner = await prisma.owners.update({
          where: { id: owner.id },
          data: {
            firebaseId: firebaseId, // Link the new firebaseId to existing account
            updatedAt: new Date(),
          },
        });
        console.log('✅ OwnerCreate: Account linked successfully');
      }
    }

    if (!owner) {
      // Create with firstName and lastName (and legacy name for backward compatibility)
      const name = firstName && lastName
        ? `${firstName} ${lastName}`.trim()
        : firstName || email?.split('@')[0] || null;

      owner = await prisma.owners.create({
        data: {
          firebaseId,
          firstName: firstName || null,
          lastName: lastName || null,
          name: name || null, // Keep for backward compatibility
          email: email || null,
          photoURL: photoURL || null,
        },
      });
      console.log('✅ Created new owner:', owner.id, { firebaseId, email, firstName, lastName });
    } else {
      // Update existing owner with latest info from sign-in (but preserve existing data)
      const updateData = {};
      
      // Only update fields if new values are provided and different
      if (email && email !== owner.email) {
        updateData.email = email;
      }
      if (photoURL && photoURL !== owner.photoURL) {
        updateData.photoURL = photoURL;
      }
      // Update name fields if provided and different (trim whitespace)
      if (firstName && firstName.trim() !== (owner.firstName || '').trim()) {
        updateData.firstName = firstName.trim();
      }
      if (lastName && lastName.trim() !== (owner.lastName || '').trim()) {
        updateData.lastName = lastName.trim();
      }
      
      // Update name field if firstName/lastName changed
      if (updateData.firstName || updateData.lastName) {
        const newFirstName = updateData.firstName || owner.firstName || '';
        const newLastName = updateData.lastName || owner.lastName || '';
        if (newFirstName || newLastName) {
          updateData.name = `${newFirstName} ${newLastName}`.trim();
        }
      }
      
      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        owner = await prisma.owners.update({
          where: { id: owner.id },
          data: {
            ...updateData,
            updatedAt: new Date(),
          },
        });
        console.log('✅ Updated existing owner:', owner.id, { firebaseId, email, updates: Object.keys(updateData) });
      } else {
        console.log('✅ Found existing owner (no updates needed):', owner.id, { firebaseId, email });
      }
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

