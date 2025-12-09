/**
 * LocalStorage Data Migration Script
 * 
 * Migrates data from localStorage JSON export to Neon database
 * 
 * Usage:
 *   node scripts/migrate-localstorage-data.js <path-to-json-file>
 * 
 * Or paste JSON directly into the script below (see INLINE_DATA)
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Load data from file or use inline data
function loadData(inputPath) {
  if (inputPath && fs.existsSync(inputPath)) {
    const fileContent = fs.readFileSync(inputPath, 'utf8');
    return JSON.parse(fileContent);
  }
  return null;
}

async function migrateData(localStorageData) {
  const results = {
    owner: null,
    companyHQs: { created: 0, updated: 0, errors: [] },
    personas: { created: 0, skipped: 0, errors: [] },
    contacts: { created: 0, skipped: 0, errors: [] },
    companies: { created: 0, skipped: 0, errors: [] },
    products: { created: 0, skipped: 0, errors: [] },
    presentations: { created: 0, skipped: 0, errors: [] },
    workPackages: { created: 0, skipped: 0, errors: [] },
    phaseTemplates: { created: 0, skipped: 0, errors: [] },
    deliverableTemplates: { created: 0, skipped: 0, errors: [] },
    pipelines: { created: 0, skipped: 0, errors: [] },
  };

  const companyHQMap = new Map(); // oldId -> newId
  const contactMap = new Map(); // oldId -> newId
  const companyMap = new Map(); // oldId -> newId

  try {
    // 1. Find or create Owner
    let ownerId = null;
    const ownerData = localStorageData.owner;
    if (ownerData && ownerData.firebaseId) {
      try {
        let owner = await prisma.owner.findUnique({
          where: { firebaseId: ownerData.firebaseId },
        });

        if (!owner) {
          owner = await prisma.owner.create({
            data: {
              firebaseId: ownerData.firebaseId,
              name: ownerData.name || null,
              email: ownerData.email || null,
              photoURL: ownerData.photoURL || null,
              teamSize: ownerData.teamSize || null,
            },
          });
          console.log('✅ Owner created:', owner.id);
        } else {
          // Update owner
          owner = await prisma.owner.update({
            where: { id: owner.id },
            data: {
              name: ownerData.name || owner.name,
              email: ownerData.email || owner.email,
              photoURL: ownerData.photoURL || owner.photoURL,
              teamSize: ownerData.teamSize || owner.teamSize,
            },
          });
          console.log('✅ Owner updated:', owner.id);
        }
        ownerId = owner.id;
        results.owner = { id: owner.id, action: owner ? 'updated' : 'created' };
      } catch (error) {
        console.error('❌ Owner migration error:', error.message);
        results.owner = { error: error.message };
      }
    }

    if (!ownerId) {
      console.error('❌ No owner found or created. Cannot proceed.');
      return results;
    }

    // 2. Migrate CompanyHQs
    const companyHQKeys = Object.keys(localStorageData).filter(key => 
      key.startsWith('companyHydration_') || key === 'companyHQ'
    );

    for (const key of companyHQKeys) {
      let companyHQData = null;
      
      if (key === 'companyHQ') {
        companyHQData = localStorageData[key];
      } else if (key.startsWith('companyHydration_')) {
        const hydration = localStorageData[key];
        if (hydration?.data?.companyHQ) {
          companyHQData = hydration.data.companyHQ;
        }
      }

      if (!companyHQData) continue;

      try {
        const oldId = companyHQData.id;
        
        // Check if companyHQ already exists
        let companyHQ = await prisma.companyHQ.findFirst({
          where: {
            ownerId: ownerId,
            companyName: companyHQData.companyName,
          },
        });

        if (companyHQ) {
          // Update existing
          companyHQ = await prisma.companyHQ.update({
            where: { id: companyHQ.id },
            data: {
              companyName: companyHQData.companyName,
              whatYouDo: companyHQData.whatYouDo || null,
              companyStreet: companyHQData.companyStreet || null,
              companyCity: companyHQData.companyCity || null,
              companyState: companyHQData.companyState || null,
              companyWebsite: companyHQData.companyWebsite || null,
              companyIndustry: companyHQData.companyIndustry || null,
              companyAnnualRev: typeof companyHQData.companyAnnualRev === 'string' 
                ? companyHQData.companyAnnualRev 
                : (companyHQData.companyAnnualRev?.toString() || null),
              yearsInBusiness: typeof companyHQData.yearsInBusiness === 'string'
                ? companyHQData.yearsInBusiness
                : (companyHQData.yearsInBusiness?.toString() || null),
              teamSize: companyHQData.teamSize || null,
              ownerId: ownerId,
              ultraTenantId: companyHQData.ultraTenantId || 'cmhmdw78k0001mb1vioxdw2g8',
            },
          });
          results.companyHQs.updated++;
          console.log('✅ CompanyHQ updated:', companyHQ.id);
        } else {
          // Create new
          companyHQ = await prisma.companyHQ.create({
            data: {
              companyName: companyHQData.companyName,
              whatYouDo: companyHQData.whatYouDo || null,
              companyStreet: companyHQData.companyStreet || null,
              companyCity: companyHQData.companyCity || null,
              companyState: companyHQData.companyState || null,
              companyWebsite: companyHQData.companyWebsite || null,
              companyIndustry: companyHQData.companyIndustry || null,
              companyAnnualRev: typeof companyHQData.companyAnnualRev === 'string'
                ? companyHQData.companyAnnualRev
                : (companyHQData.companyAnnualRev?.toString() || null),
              yearsInBusiness: typeof companyHQData.yearsInBusiness === 'string'
                ? companyHQData.yearsInBusiness
                : (companyHQData.yearsInBusiness?.toString() || null),
              teamSize: companyHQData.teamSize || null,
              ownerId: ownerId,
              ultraTenantId: companyHQData.ultraTenantId || 'cmhmdw78k0001mb1vioxdw2g8',
            },
          });
          results.companyHQs.created++;
          console.log('✅ CompanyHQ created:', companyHQ.id);
        }

        if (oldId) {
          companyHQMap.set(oldId, companyHQ.id);
        }
      } catch (error) {
        console.error(`❌ CompanyHQ migration error (${key}):`, error.message);
        results.companyHQs.errors.push({ key, error: error.message });
      }
    }

    // Get the primary companyHQId (first one found or from localStorage)
    const primaryCompanyHQId = companyHQMap.values().next().value || 
                                localStorageData.companyHQId ||
                                (localStorageData.companyHQ?.id ? companyHQMap.get(localStorageData.companyHQ.id) : null);

    if (!primaryCompanyHQId) {
      console.error('❌ No CompanyHQ found. Cannot migrate dependent data.');
      return results;
    }

    // 3. Migrate Companies (from contacts' contactCompany)
    const contacts = [];
    for (const key of companyHQKeys) {
      if (key.startsWith('companyHydration_')) {
        const hydration = localStorageData[key];
        if (hydration?.data?.contacts) {
          contacts.push(...hydration.data.contacts);
        }
      }
    }
    if (localStorageData.contacts) {
      contacts.push(...localStorageData.contacts);
    }

    // Extract and migrate companies
    const companiesToMigrate = new Map();
    contacts.forEach(contact => {
      if (contact.contactCompany && contact.contactCompany.id) {
        companiesToMigrate.set(contact.contactCompany.id, contact.contactCompany);
      }
    });

    for (const [oldCompanyId, companyData] of companiesToMigrate) {
      try {
        // Check if company exists by name or domain
        let company = await prisma.company.findFirst({
          where: {
            companyName: companyData.companyName,
            companyHQId: primaryCompanyHQId,
          },
        });

        if (!company && companyData.companyName) {
          company = await prisma.company.create({
            data: {
              companyHQId: primaryCompanyHQId,
              companyName: companyData.companyName,
              industry: companyData.industry || null,
              website: companyData.website || null,
            },
          });
          results.companies.created++;
          console.log('✅ Company created:', company.id);
        } else {
          results.companies.skipped++;
        }

        if (company && oldCompanyId) {
          companyMap.set(oldCompanyId, company.id);
        }
      } catch (error) {
        console.error(`❌ Company migration error (${oldCompanyId}):`, error.message);
        results.companies.errors.push({ company: companyData.companyName, error: error.message });
      }
    }

    // 4. Migrate Contacts
    const uniqueContacts = new Map();
    contacts.forEach(contact => {
      if (contact.email && !uniqueContacts.has(contact.email)) {
        uniqueContacts.set(contact.email, contact);
      } else if (contact.id && !uniqueContacts.has(contact.id)) {
        uniqueContacts.set(contact.id, contact);
      }
    });

    for (const contactData of uniqueContacts.values()) {
      try {
        // Find companyHQId for this contact
        const contactCompanyHQId = contactData.crmId 
          ? (companyHQMap.get(contactData.crmId) || primaryCompanyHQId)
          : primaryCompanyHQId;

        // Check if contact exists
        let contact = null;
        if (contactData.email) {
          contact = await prisma.contact.findUnique({
            where: { email: contactData.email },
          });
        }

        if (contact) {
          results.contacts.skipped++;
          if (contactData.id) {
            contactMap.set(contactData.id, contact.id);
          }
          continue;
        }

        // Create contact
        const newContact = await prisma.contact.create({
          data: {
            crmId: contactCompanyHQId,
            firstName: contactData.firstName || null,
            lastName: contactData.lastName || null,
            goesBy: contactData.goesBy || null,
            email: contactData.email || null,
            phone: contactData.phone || null,
            title: contactData.title || null,
            buyerDecision: contactData.buyerDecision || null,
            howMet: contactData.howMet || null,
            notes: contactData.notes || null,
            companyId: contactData.contactCompanyId ? companyMap.get(contactData.contactCompanyId) : null,
            contactCompanyId: contactData.contactCompanyId ? companyMap.get(contactData.contactCompanyId) : null,
          },
        });

        results.contacts.created++;
        if (contactData.id) {
          contactMap.set(contactData.id, newContact.id);
        }
        console.log('✅ Contact created:', newContact.id, newContact.email);

        // Migrate pipeline if exists
        if (contactData.pipeline) {
          try {
            await prisma.pipeline.upsert({
              where: { contactId: newContact.id },
              update: {
                pipeline: contactData.pipeline.pipeline || 'prospect',
                stage: contactData.pipeline.stage || 'lead',
              },
              create: {
                contactId: newContact.id,
                pipeline: contactData.pipeline.pipeline || 'prospect',
                stage: contactData.pipeline.stage || 'lead',
              },
            });
            results.pipelines.created++;
          } catch (error) {
            results.pipelines.errors.push({ contact: contactData.email, error: error.message });
          }
        }
      } catch (error) {
        console.error(`❌ Contact migration error (${contactData.email || contactData.id}):`, error.message);
        results.contacts.errors.push({ 
          contact: contactData.email || contactData.firstName || 'Unknown', 
          error: error.message 
        });
      }
    }

    // 5. Migrate Personas
    const personas = [];
    for (const key of companyHQKeys) {
      if (key.startsWith('companyHydration_')) {
        const hydration = localStorageData[key];
        if (hydration?.data?.personas) {
          personas.push(...hydration.data.personas);
        }
      }
    }
    if (localStorageData.personas) {
      personas.push(...localStorageData.personas);
    }

    for (const personaData of personas) {
      try {
        const personaCompanyHQId = personaData.companyHQId
          ? (companyHQMap.get(personaData.companyHQId) || primaryCompanyHQId)
          : primaryCompanyHQId;

        const existing = await prisma.persona.findFirst({
          where: {
            companyHQId: personaCompanyHQId,
            personName: personaData.personName || personaData.name || '',
            title: personaData.title || '',
          },
        });

        if (existing) {
          results.personas.skipped++;
          continue;
        }

        await prisma.persona.create({
          data: {
            companyHQId: personaCompanyHQId,
            personName: personaData.personName || personaData.name || '',
            title: personaData.title || '',
            headline: personaData.headline || null,
            seniority: personaData.seniority || null,
            industry: personaData.industry || null,
            subIndustries: personaData.subIndustries || [],
            company: personaData.company || null,
            companySize: personaData.companySize || null,
            annualRevenue: personaData.annualRevenue || null,
            location: personaData.location || null,
            description: personaData.description || personaData.goals || null,
            whatTheyWant: personaData.whatTheyWant || personaData.desiredOutcome || null,
            painPoints: personaData.painPoints || (personaData.painPoints ? personaData.painPoints.split('\n') : []),
            risks: personaData.risks || [],
            decisionDrivers: personaData.decisionDrivers || [],
            buyerTriggers: personaData.buyerTriggers || [],
            productId: personaData.productId || null,
          },
        });
        results.personas.created++;
        console.log('✅ Persona created');
      } catch (error) {
        console.error('❌ Persona migration error:', error.message);
        results.personas.errors.push({ persona: personaData.personName || personaData.name, error: error.message });
      }
    }

    // 6. Migrate Presentations
    const presentationKeys = Object.keys(localStorageData).filter(key => 
      key.startsWith('presentations_')
    );
    
    const presentations = [];
    presentationKeys.forEach(key => {
      const presArray = localStorageData[key];
      if (Array.isArray(presArray)) {
        presentations.push(...presArray);
      }
    });

    for (const presData of presentations) {
      try {
        const presCompanyHQId = presData.companyHQId
          ? (companyHQMap.get(presData.companyHQId) || primaryCompanyHQId)
          : primaryCompanyHQId;

        const existing = await prisma.presentation.findFirst({
          where: {
            companyHQId: presCompanyHQId,
            title: presData.title || '',
          },
        });

        if (existing) {
          results.presentations.skipped++;
          continue;
        }

        await prisma.presentation.create({
          data: {
            companyHQId: presCompanyHQId,
            title: presData.title || '',
            slides: presData.slides || null,
            presenter: presData.presenter || null,
            description: presData.description || null,
            feedback: presData.feedback || null,
            published: presData.published || false,
            publishedAt: presData.publishedAt ? new Date(presData.publishedAt) : null,
          },
        });
        results.presentations.created++;
        console.log('✅ Presentation created:', presData.title);
      } catch (error) {
        console.error('❌ Presentation migration error:', error.message);
        results.presentations.errors.push({ presentation: presData.title, error: error.message });
      }
    }

    // 7. Migrate Work Packages
    const workPackages = [];
    for (const key of companyHQKeys) {
      if (key.startsWith('companyHydration_')) {
        const hydration = localStorageData[key];
        if (hydration?.data?.workPackages) {
          workPackages.push(...hydration.data.workPackages);
        }
      }
    }
    if (localStorageData.workPackages) {
      workPackages.push(...localStorageData.workPackages);
    }

    for (const wpData of workPackages) {
      try {
        const contactId = wpData.contactId ? contactMap.get(wpData.contactId) : null;
        if (!contactId) {
          results.workPackages.errors.push({ 
            workPackage: wpData.title || 'Unknown', 
            error: 'Contact not found' 
          });
          continue;
        }

        const companyId = wpData.companyId ? companyMap.get(wpData.companyId) : null;

        // Create work package
        const workPackage = await prisma.workPackage.create({
          data: {
            contactId: contactId,
            companyId: companyId,
            title: wpData.title || 'Untitled Work Package',
            description: wpData.description || null,
            totalCost: wpData.totalCost || null,
            effectiveStartDate: wpData.effectiveStartDate ? new Date(wpData.effectiveStartDate) : null,
          },
        });

        // Create phases and items
        if (wpData.phases && Array.isArray(wpData.phases)) {
          for (const phaseData of wpData.phases) {
            const phase = await prisma.workPackagePhase.create({
              data: {
                workPackageId: workPackage.id,
                name: phaseData.name || '',
                position: phaseData.position || 1,
                description: phaseData.description || null,
                phaseTotalDuration: phaseData.phaseTotalDuration || null,
                totalEstimatedHours: phaseData.totalEstimatedHours || null,
                estimatedStartDate: phaseData.estimatedStartDate ? new Date(phaseData.estimatedStartDate) : null,
                estimatedEndDate: phaseData.estimatedEndDate ? new Date(phaseData.estimatedEndDate) : null,
                actualStartDate: phaseData.actualStartDate ? new Date(phaseData.actualStartDate) : null,
                actualEndDate: phaseData.actualEndDate ? new Date(phaseData.actualEndDate) : null,
                status: phaseData.status || 'not_started',
              },
            });

            // Create items
            if (phaseData.items && Array.isArray(phaseData.items)) {
              for (const itemData of phaseData.items) {
                await prisma.workPackageItem.create({
                  data: {
                    workPackageId: workPackage.id,
                    workPackagePhaseId: phase.id,
                    deliverableType: itemData.deliverableType || itemData.itemType || '',
                    deliverableLabel: itemData.deliverableLabel || itemData.itemLabel || '',
                    deliverableDescription: itemData.deliverableDescription || itemData.itemDescription || null,
                    itemType: itemData.itemType || itemData.deliverableType || '',
                    itemLabel: itemData.itemLabel || itemData.deliverableLabel || '',
                    itemDescription: itemData.itemDescription || itemData.deliverableDescription || null,
                    quantity: itemData.quantity || 1,
                    unitOfMeasure: itemData.unitOfMeasure || 'item',
                    estimatedHoursEach: itemData.estimatedHoursEach || 0,
                    duration: itemData.duration || null,
                    status: itemData.status || 'NOT_STARTED',
                  },
                });
              }
            }
          }
        }

        results.workPackages.created++;
        console.log('✅ Work Package created:', workPackage.title);
      } catch (error) {
        console.error('❌ Work Package migration error:', error.message);
        results.workPackages.errors.push({ 
          workPackage: wpData.title || 'Unknown', 
          error: error.message 
        });
      }
    }

    console.log('\n✅ Migration completed!');
    console.log(JSON.stringify(results, null, 2));

    return results;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// INLINE_DATA: Paste your localStorage JSON here if not using a file
const INLINE_DATA = null; // Set this to your JSON object if not using file

// Main execution
async function main() {
  const inputPath = process.argv[2];
  
  let data;
  if (INLINE_DATA) {
    data = INLINE_DATA;
    console.log('📦 Using inline data from script');
  } else if (inputPath) {
    data = loadData(inputPath);
    console.log(`📁 Loaded data from: ${inputPath}`);
  } else {
    console.log('Usage: node scripts/migrate-localstorage-data.js <path-to-json-file>');
    console.log('Or set INLINE_DATA in the script');
    process.exit(1);
  }

  if (!data) {
    console.error('❌ Failed to load data');
    process.exit(1);
  }

  try {
    await migrateData(data);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateData };

