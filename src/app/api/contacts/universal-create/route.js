import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { inferWebsiteFromEmail } from '@/lib/services/CompanyEnrichmentService.js';
import { ensureContactPipeline, validatePipeline } from '@/lib/services/pipelineService';

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
      contact: contactData,
      company: companyData,
      pipeline: pipelineData,
    } = body ?? {};

    if (!contactData || !contactData.crmId) {
      return NextResponse.json(
        { success: false, error: 'contact.crmId (CompanyHQId) is required' },
        { status: 400 },
      );
    }

    const crmId = contactData.crmId;

    const companyHQ = await prisma.companyHQ.findUnique({
      where: { id: crmId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    // Validate pipeline and stage if provided
    if (pipelineData?.pipeline) {
      const validation = validatePipeline(pipelineData.pipeline, pipelineData.stage);
      if (!validation.isValid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 },
        );
      }
    }

    let contactCompanyId = contactData.contactCompanyId || null;
    if (companyData && companyData.companyName) {
      const normalizedCompanyName = companyData.companyName.trim();
      let websiteUrl = companyData.website || companyData.url || companyData.companyURL;
      if (!websiteUrl && contactData.email) {
        websiteUrl = inferWebsiteFromEmail(contactData.email);
        if (websiteUrl) {
          console.log(`✅ Inferred website from email: ${websiteUrl}`);
        }
      }

      const allCompanies = await prisma.company.findMany({
        where: { companyHQId: crmId },
      });

      let company = allCompanies.find(
        (c) =>
          c.companyName &&
          c.companyName.trim().toLowerCase() === normalizedCompanyName.toLowerCase(),
      );

      if (company) {
        company = await prisma.company.findUnique({
          where: { id: company.id },
        });
      }

      if (!company) {
        company = await prisma.company.create({
          data: {
            companyHQId: crmId,
            companyName: normalizedCompanyName,
            address: companyData.address || null,
            industry: companyData.industry || null,
            website: websiteUrl || null,
            revenue: companyData.revenue || null,
            yearsInBusiness: companyData.yearsInBusiness || null,
          },
        });
        console.log(`✅ Created new company: ${normalizedCompanyName} for companyHQId: ${crmId}`);
        if (websiteUrl) {
          console.log(`✅ Stored website URL: ${websiteUrl}`);
        }
      } else {
        console.log(`✅ Found existing company: ${company.companyName} (id: ${company.id})`);
        if (websiteUrl && !company.website) {
          company = await prisma.company.update({
            where: { id: company.id },
            data: { website: websiteUrl },
          });
          console.log(`✅ Updated company with inferred website URL: ${websiteUrl}`);
        }
      }

      contactCompanyId = company.id;
    } else if (contactData.email) {
      const inferredUrl = inferWebsiteFromEmail(contactData.email);
      if (inferredUrl) {
        console.log(`💡 Could create company from email domain: ${inferredUrl}`);
      }
    }

    let contact;
    if (contactData.email) {
      const normalizedEmail = contactData.email.toLowerCase().trim();
      const allContacts = await prisma.contact.findMany({
        where: {
          crmId,
          email: { not: null },
        },
      });

      const existingContact = allContacts.find(
        (c) => c.email && c.email.toLowerCase().trim() === normalizedEmail,
      );

      if (existingContact) {
        contact = await prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            firstName: contactData.firstName || existingContact.firstName,
            lastName: contactData.lastName || existingContact.lastName,
            goesBy: contactData.goesBy || existingContact.goesBy,
            phone: contactData.phone || existingContact.phone,
            title: contactData.title || existingContact.title,
            contactCompanyId: contactCompanyId || existingContact.contactCompanyId,
            buyerDecision: contactData.buyerDecision || existingContact.buyerDecision,
            howMet: contactData.howMet || existingContact.howMet,
            notes: contactData.notes || existingContact.notes,
          },
          include: {
            pipeline: true,
            contactCompany: true,
          },
        });

        // Ensure pipeline exists (use provided values or defaults)
        await ensureContactPipeline(contact.id, {
          pipeline: pipelineData?.pipeline || 'prospect',
          stage: pipelineData?.stage || 'interest',
        });

        // Re-fetch contact with pipeline
        contact = await prisma.contact.findUnique({
          where: { id: contact.id },
          include: {
            pipeline: true,
            contactCompany: true,
          },
        });

        console.log('✅ Contact updated (universal):', contact.id);
      } else {
        contact = await prisma.contact.create({
          data: {
            crmId,
            firstName: contactData.firstName || null,
            lastName: contactData.lastName || null,
            goesBy: contactData.goesBy || null,
            email: normalizedEmail,
            phone: contactData.phone || null,
            title: contactData.title || null,
            contactCompanyId,
            buyerDecision: contactData.buyerDecision || null,
            howMet: contactData.howMet || null,
            notes: contactData.notes || null,
          },
          include: {
            pipeline: true,
            contactCompany: true,
          },
        });

        // Ensure pipeline exists (use provided values or defaults)
        await ensureContactPipeline(contact.id, {
          pipeline: pipelineData?.pipeline || 'prospect',
          stage: pipelineData?.stage || 'interest',
        });

        // Re-fetch contact with pipeline
        contact = await prisma.contact.findUnique({
          where: { id: contact.id },
          include: {
            pipeline: true,
            contactCompany: true,
          },
        });

        console.log('✅ Contact created (universal):', contact.id);
      }
    } else {
      contact = await prisma.contact.create({
        data: {
          crmId,
          firstName: contactData.firstName || null,
          lastName: contactData.lastName || null,
          goesBy: contactData.goesBy || null,
          email: contactData.email || null,
          phone: contactData.phone || null,
          title: contactData.title || null,
          contactCompanyId,
          buyerDecision: contactData.buyerDecision || null,
          howMet: contactData.howMet || null,
          notes: contactData.notes || null,
        },
        include: {
          pipeline: true,
          contactCompany: true,
        },
      });

      // Ensure pipeline exists (use provided values or defaults)
      await ensureContactPipeline(contact.id, {
        pipeline: pipelineData?.pipeline || 'prospect',
        stage: pipelineData?.stage || 'interest',
      });

      // Re-fetch contact with pipeline
      contact = await prisma.contact.findUnique({
        where: { id: contact.id },
        include: {
          pipeline: true,
          contactCompany: true,
        },
      });

      console.log('✅ Contact created (universal, no email):', contact.id);
    }

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    console.error('❌ UniversalCreateContact error:', error);
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

