/**
 * Seed Platform: Ignite Strategies
 * 
 * Creates the single-tenant platform record in IgniteBd-Next-combine
 * This must match the platform ID in platform-manager
 * 
 * Run: node scripts/seed-platform.js
 */

require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const PLATFORM_ID = 'platform-ignite-strategies-001'
const PLATFORM_NAME = 'Ignite Strategies'

async function seedPlatform() {
  try {
    console.log('🌱 Seeding platform in IgniteBd-Next-combine...\n')

    // Check if platform already exists
    const existing = await prisma.platform.findUnique({
      where: { id: PLATFORM_ID },
    })

    if (existing) {
      console.log('✅ Platform already exists:')
      console.log({
        id: existing.id,
        name: existing.name,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      })
      
      // Update name if it's different
      if (existing.name !== PLATFORM_NAME) {
        console.log(`\n📝 Updating platform name to "${PLATFORM_NAME}"...`)
        const updated = await prisma.platform.update({
          where: { id: PLATFORM_ID },
          data: { name: PLATFORM_NAME },
        })
        console.log('✅ Platform name updated!')
        console.log({
          id: updated.id,
          name: updated.name,
        })
      }
      
      // Check how many company_hqs reference this platform
      const companyCount = await prisma.company_hqs.count({
        where: { platformId: PLATFORM_ID },
      })
      console.log(`\n📊 Companies using this platform: ${companyCount}`)
      
      return
    }

    // Create platform
    console.log(`📦 Creating platform: ${PLATFORM_NAME}`)
    const platform = await prisma.platform.create({
      data: {
        id: PLATFORM_ID,
        name: PLATFORM_NAME,
      },
    })

    console.log('✅ Platform created successfully!')
    console.log({
      id: platform.id,
      name: platform.name,
      createdAt: platform.createdAt,
    })
    console.log('\n💡 This is a single-tenant platform.')
    console.log('   You can add address, EIN, and other fields later.')
    console.log('\n⚠️  IMPORTANT: Make sure this platform ID matches the one in platform-manager!')
  } catch (error) {
    console.error('❌ Error seeding platform:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedPlatform()
  .then(() => {
    console.log('\n✅ Seed complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Seed failed:', error)
    process.exit(1)
  })

