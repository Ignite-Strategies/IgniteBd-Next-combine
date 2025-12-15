import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/migration/localstorage
 * 
 * Migrates data from localStorage to database
 * Expects a payload with all the localStorage data
 */
export async function POST(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found. Please sign in first.' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const {
      companyHQ,
      personas = [],
      contacts = [],
      products = [],
      proposals = [],
      phaseTemplates = [],
      deliverableTemplates = [],
      workPackages = [],
      presentations = [],
      blogs = [],
      templates = [],
      landingPages = [],
    } = body;

    const results = {
      companyHQ: null,
      personas: { created: 0, skipped: 0, errors: [] },
      contacts: { created: 0, skipped: 0, errors: [] },
      products: { created: 0, skipped: 0, errors: [] },
      proposals: { created: 0, skipped: 0, errors: [] },
      phaseTemplates: { created: 0, skipped: 0, errors: [] },
      deliverableTemplates: { created: 0, skipped: 0, errors: [] },
      workPackages: { created: 0, skipped: 0, errors: [] },
      presentations: { created: 0, skipped: 0, errors: [] },
      blogs: { created: 0, skipped: 0, errors: [] },
      templates: { created: 0, skipped: 0, errors: [] },
      landingPages: { created: 0, skipped: 0, errors: [] },
    };

    let companyHQId = null;

    // 1. Upsert CompanyHQ
    if (companyHQ) {
      try {
        // Check if owner already has a company
        const existingCompany = await prisma.companyHQ.findFirst({
          where: { ownerId: owner.id },
        });

        if (existingCompany) {
          // Update existing
          const updated = await prisma.companyHQ.update({
            where: { id: existingCompany.id },
            data: {
              companyName: companyHQ.companyName || existingCompany.companyName,
              whatYouDo: companyHQ.whatYouDo || existingCompany.whatYouDo,
              companyStreet: companyHQ.companyStreet || existingCompany.companyStreet,
              companyCity: companyHQ.companyCity || existingCompany.companyCity,
              companyState: companyHQ.companyState || existingCompany.companyState,
              companyWebsite: companyHQ.companyWebsite || existingCompany.companyWebsite,
              companyIndustry: companyHQ.companyIndustry || existingCompany.companyIndustry,
              companyAnnualRev: companyHQ.companyAnnualRev || existingCompany.companyAnnualRev,
              yearsInBusiness: companyHQ.yearsInBusiness || existingCompany.yearsInBusiness,
              teamSize: companyHQ.teamSize || existingCompany.teamSize,
            },
          });
          companyHQId = updated.id;
          results.companyHQ = { id: updated.id, action: 'updated' };
        } else {
          // Create new
          const ULTRA_TENANT_ID = 'cmhmdw78k0001mb1vioxdw2g8';
          const created = await prisma.companyHQ.create({
            data: {
              companyName: companyHQ.companyName || 'My Company',
              whatYouDo: companyHQ.whatYouDo || null,
              companyStreet: companyHQ.companyStreet || null,
              companyCity: companyHQ.companyCity || null,
              companyState: companyHQ.companyState || null,
              companyWebsite: companyHQ.companyWebsite || null,
              companyIndustry: companyHQ.industry || companyHQ.companyIndustry || null,
              companyAnnualRev: companyHQ.companyAnnualRev || companyHQ.annualRevenue || null,
              yearsInBusiness: companyHQ.yearsInBusiness || null,
              teamSize: companyHQ.teamSize || null,
              ownerId: owner.id,
              ultraTenantId: ULTRA_TENANT_ID,
            },
          });
          companyHQId = created.id;
          results.companyHQ = { id: created.id, action: 'created' };
        }
      } catch (error) {
        console.error('CompanyHQ migration error:', error);
        results.companyHQ = { error: error.message };
      }
    }

    // Use existing companyHQId from owner if no companyHQ was provided
    if (!companyHQId) {
      const existingCompany = await prisma.companyHQ.findFirst({
        where: { ownerId: owner.id },
      });
      if (existingCompany) {
        companyHQId = existingCompany.id;
      }
    }

    if (!companyHQId) {
      return NextResponse.json({
        success: false,
        error: 'No companyHQ found or created. Cannot migrate other data.',
        results,
      }, { status: 400 });
    }

    // 2. Migrate Personas
    for (const persona of personas) {
      try {
        // Skip if already exists (check by name and companyHQId)
        const existing = await prisma.persona.findFirst({
          where: {
            companyHQId,
            personName: persona.personName || persona.name || '',
            title: persona.title || '',
          },
        });

        if (existing) {
          results.personas.skipped++;
          continue;
        }

        await prisma.persona.create({
          data: {
            companyHQId,
            personName: persona.personName || persona.name || '',
            title: persona.title || '',
            headline: persona.headline || null,
            seniority: persona.seniority || null,
            industry: persona.industry || null,
            subIndustries: persona.subIndustries || [],
            company: persona.company || null,
            companySize: persona.companySize || null,
            annualRevenue: persona.annualRevenue || null,
            location: persona.location || null,
            description: persona.description || null,
            whatTheyWant: persona.whatTheyWant || null,
            painPoints: persona.painPoints || [],
            risks: persona.risks || [],
            decisionDrivers: persona.decisionDrivers || [],
            buyerTriggers: persona.buyerTriggers || [],
            productId: persona.productId || null,
          },
        });
        results.personas.created++;
      } catch (error) {
        console.error('Persona migration error:', error);
        results.personas.errors.push({ persona: persona.personName || persona.name, error: error.message });
      }
    }

    // 3. Migrate Products
    for (const product of products) {
      try {
        const existing = await prisma.product.findFirst({
          where: {
            companyHQId,
            name: product.name || '',
          },
        });

        if (existing) {
          results.products.skipped++;
          continue;
        }

        await prisma.product.create({
          data: {
            companyHQId,
            name: product.name || '',
            description: product.description || null,
            valueProp: product.valueProp || null,
            price: product.price || null,
            priceCurrency: product.priceCurrency || 'USD',
            pricingModel: product.pricingModel || null,
            category: product.category || null,
            deliveryTimeline: product.deliveryTimeline || null,
            targetMarketSize: product.targetMarketSize || null,
            salesCycleLength: product.salesCycleLength || null,
            features: product.features || null,
            competitiveAdvantages: product.competitiveAdvantages || null,
            targetedTo: product.targetedTo || null,
          },
        });
        results.products.created++;
      } catch (error) {
        console.error('Product migration error:', error);
        results.products.errors.push({ product: product.name, error: error.message });
      }
    }

    // 4. Migrate Contacts (simplified - contacts are complex with company relations)
    for (const contact of contacts) {
      try {
        // Skip if already exists (by email or by id if present)
        if (contact.email) {
          const existing = await prisma.contact.findUnique({
            where: { email: contact.email },
          });
          if (existing) {
            results.contacts.skipped++;
            continue;
          }
        }

        await prisma.contact.create({
          data: {
            crmId: companyHQId,
            firstName: contact.firstName || null,
            lastName: contact.lastName || null,
            fullName: contact.fullName || null,
            goesBy: contact.goesBy || null,
            email: contact.email || null,
            phone: contact.phone || null,
            title: contact.title || null,
            seniority: contact.seniority || null,
            department: contact.department || null,
            jobRole: contact.jobRole || null,
            linkedinUrl: contact.linkedinUrl || null,
            city: contact.city || null,
            state: contact.state || null,
            country: contact.country || null,
            timezone: contact.timezone || null,
            companyName: contact.companyName || null,
            companyDomain: contact.companyDomain || null,
            companySize: contact.companySize || null,
            companyIndustry: contact.companyIndustry || null,
            buyerDecision: contact.buyerDecision || null,
            howMet: contact.howMet || null,
            notes: contact.notes || null,
            domain: contact.domain || null,
          },
        });
        results.contacts.created++;
      } catch (error) {
        console.error('Contact migration error:', error);
        results.contacts.errors.push({ 
          contact: contact.email || contact.firstName || 'Unknown', 
          error: error.message 
        });
      }
    }

    // 5. Migrate Phase Templates
    for (const template of phaseTemplates) {
      try {
        const existing = await prisma.phaseTemplate.findUnique({
          where: {
            companyHQId_name: {
              companyHQId,
              name: template.name || '',
            },
          },
        });

        if (existing) {
          results.phaseTemplates.skipped++;
          continue;
        }

        await prisma.phaseTemplate.create({
          data: {
            companyHQId,
            name: template.name || '',
            description: template.description || null,
          },
        });
        results.phaseTemplates.created++;
      } catch (error) {
        console.error('PhaseTemplate migration error:', error);
        results.phaseTemplates.errors.push({ template: template.name, error: error.message });
      }
    }

    // 6. Migrate Deliverable Templates
    for (const template of deliverableTemplates) {
      try {
        const existing = await prisma.deliverableTemplate.findUnique({
          where: {
            companyHQId_deliverableType: {
              companyHQId,
              deliverableType: template.deliverableType || '',
            },
          },
        });

        if (existing) {
          results.deliverableTemplates.skipped++;
          continue;
        }

        await prisma.deliverableTemplate.create({
          data: {
            companyHQId,
            deliverableType: template.deliverableType || '',
            deliverableLabel: template.deliverableLabel || '',
            defaultUnitOfMeasure: template.defaultUnitOfMeasure || 'day',
            defaultDuration: template.defaultDuration || 1,
          },
        });
        results.deliverableTemplates.created++;
      } catch (error) {
        console.error('DeliverableTemplate migration error:', error);
        results.deliverableTemplates.errors.push({ 
          template: template.deliverableLabel || template.deliverableType, 
          error: error.message 
        });
      }
    }

    // 7. Migrate Presentations
    for (const presentation of presentations) {
      try {
        const existing = await prisma.presentation.findFirst({
          where: {
            companyHQId,
            title: presentation.title || '',
          },
        });

        if (existing) {
          results.presentations.skipped++;
          continue;
        }

        await prisma.presentation.create({
          data: {
            companyHQId,
            title: presentation.title || '',
            slides: presentation.slides || null,
            presenter: presentation.presenter || null,
            description: presentation.description || null,
            feedback: presentation.feedback || null,
            published: presentation.published || false,
            publishedAt: presentation.publishedAt ? new Date(presentation.publishedAt) : null,
            gammaStatus: presentation.gammaStatus || null,
            gammaDeckUrl: presentation.gammaDeckUrl || null,
            gammaPptxUrl: presentation.gammaPptxUrl || null,
            gammaBlob: presentation.gammaBlob || null,
            gammaError: presentation.gammaError || null,
          },
        });
        results.presentations.created++;
      } catch (error) {
        console.error('Presentation migration error:', error);
        results.presentations.errors.push({ presentation: presentation.title, error: error.message });
      }
    }

    // 8. Migrate Blogs
    for (const blog of blogs) {
      try {
        const existing = await prisma.blog.findFirst({
          where: {
            companyHQId,
            title: blog.title || '',
          },
        });

        if (existing) {
          results.blogs.skipped++;
          continue;
        }

        await prisma.blog.create({
          data: {
            companyHQId,
            title: blog.title || '',
            subtitle: blog.subtitle || null,
            blogText: blog.blogText || null,
            sections: blog.sections || null,
          },
        });
        results.blogs.created++;
      } catch (error) {
        console.error('Blog migration error:', error);
        results.blogs.errors.push({ blog: blog.title, error: error.message });
      }
    }

    // 9. Migrate Templates
    for (const template of templates) {
      try {
        const existing = await prisma.template.findFirst({
          where: {
            companyHQId,
            name: template.name || '',
          },
        });

        if (existing) {
          results.templates.skipped++;
          continue;
        }

        await prisma.template.create({
          data: {
            companyHQId,
            name: template.name || '',
            subject: template.subject || null,
            body: template.body || null,
            type: template.type || null,
            published: template.published || false,
            publishedAt: template.publishedAt ? new Date(template.publishedAt) : null,
          },
        });
        results.templates.created++;
      } catch (error) {
        console.error('Template migration error:', error);
        results.templates.errors.push({ template: template.name, error: error.message });
      }
    }

    // 10. Migrate Landing Pages
    for (const landingPage of landingPages) {
      try {
        const existing = await prisma.landingPage.findFirst({
          where: {
            companyHQId,
            title: landingPage.title || '',
          },
        });

        if (existing) {
          results.landingPages.skipped++;
          continue;
        }

        await prisma.landingPage.create({
          data: {
            companyHQId,
            title: landingPage.title || '',
            url: landingPage.url || null,
            content: landingPage.content || null,
            description: landingPage.description || null,
            published: landingPage.published || false,
            publishedAt: landingPage.publishedAt ? new Date(landingPage.publishedAt) : null,
          },
        });
        results.landingPages.created++;
      } catch (error) {
        console.error('LandingPage migration error:', error);
        results.landingPages.errors.push({ landingPage: landingPage.title, error: error.message });
      }
    }

    // Note: Proposals and WorkPackages are complex with many relations
    // They should be migrated separately or manually as they depend on contacts, companies, etc.

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results,
      companyHQId,
    });
  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

