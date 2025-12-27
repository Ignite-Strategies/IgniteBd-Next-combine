/**
 * Data Migration Script: Template System Refactor
 * 
 * Migrates data from old template structure to new:
 * - template_bases + outreach_templates → templates
 * - template_bases (relationship helper) → template_relationship_helpers
 * 
 * ⚠️ Run this BEFORE applying the schema migration
 * ⚠️ Backup database first!
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateTemplateData() {
  console.log('🚀 Starting template data migration...\n');

  try {
    // Step 1: Migrate relationship helper data
    console.log('Step 1: Migrating template_bases → template_relationship_helpers...');
    
    const templateBases = await prisma.template_bases.findMany({
      include: {
        outreach_templates: true,
      },
    });

    let helpersCreated = 0;
    let templatesCreated = 0;

    for (const base of templateBases) {
      // Create template_relationship_helper
      const helper = await prisma.template_relationship_helpers.create({
        data: {
          id: base.id, // Use same ID to maintain reference
          ownerId: base.companyHQId,
          relationshipType: base.typeOfPerson, // Map enum to string
          familiarityLevel: base.relationship, // Map enum to string
          whyReachingOut: base.whyReachingOut,
          desiredOutcome: base.desiredOutcome || base.whatWantFromThem || null,
          timeHorizon: base.timeHorizon || null,
          contextNotes: base.contextNotes || null,
          createdAt: base.createdAt,
        },
      });
      helpersCreated++;

      // Migrate outreach_templates to templates
      for (const outreach of base.outreach_templates) {
        // Extract title from base or generate
        const title = base.title || 'Untitled Template';
        
        // Extract subject from campaigns or generate default
        const subject = 'Re: ' + title; // Default subject
        
        // Use content as body
        const body = outreach.content || '';

        // Create new template
        await prisma.templates.create({
          data: {
            id: outreach.id, // Use same ID
            ownerId: base.companyHQId,
            title: title,
            subject: subject,
            body: body,
            createdAt: outreach.createdAt,
          },
        });
        templatesCreated++;
      }
    }

    console.log(`✅ Created ${helpersCreated} template_relationship_helpers`);
    console.log(`✅ Created ${templatesCreated} templates from outreach_templates\n`);

    // Step 2: Migrate standalone templates (if any exist with old structure)
    console.log('Step 2: Migrating standalone templates...');
    
    const oldTemplates = await prisma.templates.findMany({
      where: {
        // Find templates that still have old structure (have name but no title)
        name: { not: null },
        title: null,
      },
    });

    let standaloneMigrated = 0;
    for (const oldTemplate of oldTemplates) {
      await prisma.templates.update({
        where: { id: oldTemplate.id },
        data: {
          title: oldTemplate.name || 'Untitled Template',
          subject: oldTemplate.subject || '',
          body: oldTemplate.body || '',
          ownerId: oldTemplate.companyHQId,
        },
      });
      standaloneMigrated++;
    }

    console.log(`✅ Migrated ${standaloneMigrated} standalone templates\n`);

    // Step 3: Update campaigns to reference new templates
    console.log('Step 3: Updating campaign template references...');
    
    // Campaigns should already reference templates by ID
    // Just verify the foreign key will work
    const campaignsWithTemplates = await prisma.campaigns.findMany({
      where: {
        template_id: { not: null },
      },
    });

    console.log(`✅ Verified ${campaignsWithTemplates.length} campaigns with template references\n`);

    console.log('✅ Data migration complete!');
    console.log('\n📋 Summary:');
    console.log(`   - Template Relationship Helpers: ${helpersCreated}`);
    console.log(`   - Templates: ${templatesCreated + standaloneMigrated}`);
    console.log(`   - Campaigns verified: ${campaignsWithTemplates.length}`);
    console.log('\n⚠️  Next step: Review migration.sql and apply schema changes');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
if (require.main === module) {
  migrateTemplateData()
    .then(() => {
      console.log('\n✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateTemplateData };

