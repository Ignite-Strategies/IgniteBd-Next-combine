/**
 * Create SuperAdmin Record
 * Run: node scripts/create-superadmin.js [ownerEmail]
 * 
 * Creates a SuperAdmin record for the specified Owner (by email)
 * If no email provided, uses the first Owner found
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    const ownerEmail = process.argv[2];

    // Find Owner (by email if provided, otherwise first Owner)
    let owner;
    if (ownerEmail) {
      owner = await prisma.owner.findFirst({
        where: {
          email: {
            contains: ownerEmail,
            mode: 'insensitive',
          },
        },
      });
      
      if (!owner) {
        console.log(`❌ Owner not found with email containing: ${ownerEmail}`);
        return;
      }
    } else {
      owner = await prisma.owner.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      
      if (!owner) {
        console.log('❌ No Owners found in database');
        return;
      }
    }

    console.log('✅ Found Owner:', {
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });

    // Check if SuperAdmin already exists
    const existingSuperAdmin = await prisma.superAdmin.findUnique({
      where: { ownerId: owner.id },
    });

    if (existingSuperAdmin) {
      if (existingSuperAdmin.active) {
        console.log('⚠️  SuperAdmin already exists and is active for this Owner');
        console.log('SuperAdmin:', {
          id: existingSuperAdmin.id,
          ownerId: existingSuperAdmin.ownerId,
          active: existingSuperAdmin.active,
        });
      } else {
        // Reactivate
        const updated = await prisma.superAdmin.update({
          where: { id: existingSuperAdmin.id },
          data: { active: true },
        });
        console.log('✅ Reactivated SuperAdmin:', {
          id: updated.id,
          ownerId: updated.ownerId,
          active: updated.active,
        });
      }
    } else {
      // Create SuperAdmin
      const superAdmin = await prisma.superAdmin.create({
        data: {
          ownerId: owner.id,
          active: true,
        },
      });

      console.log('✅ Created SuperAdmin:', {
        id: superAdmin.id,
        ownerId: superAdmin.ownerId,
        active: superAdmin.active,
      });
    }

    console.log('✅ SuperAdmin setup complete!');
  } catch (error) {
    console.error('❌ Error creating SuperAdmin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();

