import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { findOrCreateCompanyByDomain } from '@/lib/services/companyService';
import { ensureContactPipeline, validatePipeline } from '@/lib/services/pipelineService';
import { isValidPipeline, isValidStageForPipeline } from '@/lib/config/pipelineConfig';

export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');
    const pipeline = searchParams.get('pipeline');
    const stage = searchParams.get('stage');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const where = {
      crmId: companyHQId,
    };

    if (pipeline || stage) {
      where.pipeline = {};
      if (pipeline) {
        where.pipeline.pipeline = pipeline;
      }
      if (stage) {
        where.pipeline.stage = stage;
      }
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        pipeline: true,
        company: true, // Universal company relation
        contactCompany: true, // Legacy relation for backward compatibility
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      contacts,
    });
  } catch (error) {
    console.error('❌ GetContacts error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch contacts',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      crmId,
      firstName,
      lastName,
      goesBy,
      email,
      phone,
      title,
      contactCompanyId,
      contactCompanyName,
      pipeline,
      stage,
      buyerDecision,
      buyerPerson,
      buyingReadiness,
      howMet,
      notes,
    } = body ?? {};

    if (!crmId) {
      return NextResponse.json(
        { success: false, error: 'crmId (CompanyHQId) is required' },
        { status: 400 },
      );
    }

    const companyHQ = await prisma.company_hqs.findUnique({
      where: { id: crmId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    // Validate pipeline and stage if provided
    if (pipeline) {
      const validation = validatePipeline(pipeline, stage);
      if (!validation.isValid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 },
        );
      }
    }

    // Handle company association - use domain matching for universal company records
    let finalCompanyId = null;
    let finalContactCompanyId = null; // Legacy field for backward compatibility
    
    // Extract domain from email if available
    let companyDomain = null;
    if (email && email.includes('@')) {
      companyDomain = email.split('@')[1].toLowerCase();
    }
    
    // If contactCompanyName provided, try to find/create by name first
    if (contactCompanyName) {
      const normalizedCompanyName = contactCompanyName.trim();
      const allCompanies = await prisma.companies.findMany({
        where: { companyHQId: crmId },
      });

      let company = allCompanies.find(
        (c) =>
          c.companyName &&
          c.companyName.trim().toLowerCase() === normalizedCompanyName.toLowerCase(),
      );

      if (!company && companyDomain) {
        // Try to find by domain
        company = await findOrCreateCompanyByDomain(companyDomain, crmId, normalizedCompanyName);
      } else if (!company) {
        // Create new company without domain
        company = await prisma.companies.create({
          data: {
            companyHQId: crmId,
            companyName: normalizedCompanyName,
          },
        });
        console.log(`✅ Created new company: ${normalizedCompanyName} for companyHQId: ${crmId}`);
      }

      if (company) {
        finalCompanyId = company.id;
        finalContactCompanyId = company.id; // Also set legacy field
      }
    } else if (companyDomain) {
      // No company name, but we have domain - find or create by domain
      const company = await findOrCreateCompanyByDomain(companyDomain, crmId);
      if (company) {
        finalCompanyId = company.id;
        finalContactCompanyId = company.id; // Also set legacy field
      }
    } else if (contactCompanyId) {
      // Legacy: use provided contactCompanyId
      finalCompanyId = contactCompanyId;
      finalContactCompanyId = contactCompanyId;
    }

    let contact;
    if (email) {
      const existingContact = await prisma.contact.findFirst({
        where: {
          crmId,
          email,
        },
        include: {
          pipeline: true,
          contactCompany: true,
        },
      });

      if (existingContact) {
        contact = await prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            firstName: firstName || existingContact.firstName,
            lastName: lastName || existingContact.lastName,
            goesBy: goesBy || existingContact.goesBy,
            phone: phone || existingContact.phone,
            title: title || existingContact.title,
            companyId: finalCompanyId || existingContact.companyId,
            contactCompanyId: finalContactCompanyId || existingContact.contactCompanyId, // Legacy field
            buyerDecision: buyerDecision || existingContact.buyerDecision,
            buyerPerson: buyerPerson !== undefined ? buyerPerson : existingContact.buyerPerson,
            buyingReadiness: buyingReadiness !== undefined ? buyingReadiness : existingContact.buyingReadiness,
            howMet: howMet || existingContact.howMet,
            notes: notes || existingContact.notes,
          },
          include: {
            pipeline: true,
            company: true, // Universal company relation
            contactCompany: true, // Legacy relation
          },
        });

        // Ensure pipeline exists (use provided values or defaults)
        await ensureContactPipeline(contact.id, {
          pipeline: pipeline || 'prospect',
          stage: stage || 'interest',
        });

        // Re-fetch contact with pipeline
        contact = await prisma.contact.findUnique({
          where: { id: contact.id },
          include: {
            pipeline: true,
            company: true,
            contactCompany: true,
          },
        });

        console.log('✅ Contact updated:', contact.id);
      } else {
        contact = await prisma.contact.create({
          data: {
            crmId,
            firstName: firstName || null,
            lastName: lastName || null,
            goesBy: goesBy || null,
            email: email.toLowerCase().trim(),
            phone: phone || null,
            title: title || null,
            companyId: finalCompanyId || null,
            contactCompanyId: finalContactCompanyId || null, // Legacy field
            buyerDecision: buyerDecision || null,
            buyerPerson: buyerPerson || null,
            buyingReadiness: buyingReadiness || null,
            howMet: howMet || null,
            notes: notes || null,
          },
          include: {
            pipeline: true,
            company: true, // Universal company relation
            contactCompany: true, // Legacy relation
          },
        });

        // Ensure pipeline exists (use provided values or defaults)
        await ensureContactPipeline(contact.id, {
          pipeline: pipeline || 'prospect',
          stage: stage || 'interest',
        });

        // Re-fetch contact with pipeline
        contact = await prisma.contact.findUnique({
          where: { id: contact.id },
          include: {
            pipeline: true,
            company: true,
            contactCompany: true,
          },
        });

        console.log('✅ Contact created:', contact.id);
      }
    } else {
      contact = await prisma.contact.create({
        data: {
          crmId,
          firstName: firstName || null,
          lastName: lastName || null,
          goesBy: goesBy || null,
          email: email || null,
          phone: phone || null,
          title: title || null,
          contactCompanyId: finalContactCompanyId || null,
          buyerDecision: buyerDecision || null,
          buyerPerson: buyerPerson || null,
          buyingReadiness: buyingReadiness || null,
          howMet: howMet || null,
          notes: notes || null,
        },
        include: {
          pipeline: true,
          contactCompany: true,
        },
      });

      // Ensure pipeline exists (use provided values or defaults)
      await ensureContactPipeline(contact.id, {
        pipeline: pipeline || 'prospect',
        stage: stage || 'interest',
      });

      // Re-fetch contact with pipeline
      contact = await prisma.contacts.findUnique({
        where: { id: contact.id },
        include: {
          pipeline: true,
          contactCompany: true,
        },
      });

      console.log('✅ Contact created (no email):', contact.id);
    }

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    console.error('❌ CreateContact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create contact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

