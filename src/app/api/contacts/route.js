import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

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
        contactCompany: true,
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
      howMet,
      notes,
    } = body ?? {};

    if (!crmId) {
      return NextResponse.json(
        { success: false, error: 'crmId (CompanyHQId) is required' },
        { status: 400 },
      );
    }

    const companyHQ = await prisma.companyHQ.findUnique({
      where: { id: crmId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    let finalContactCompanyId = contactCompanyId || null;
    if (contactCompanyName && !contactCompanyId) {
      const normalizedCompanyName = contactCompanyName.trim();
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
          },
        });
        console.log(`✅ Created new company: ${normalizedCompanyName} for companyHQId: ${crmId}`);
      } else {
        console.log(`✅ Found existing company: ${company.companyName} (id: ${company.id})`);
      }

      finalContactCompanyId = company.id;
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
            contactCompanyId: finalContactCompanyId || existingContact.contactCompanyId,
            buyerDecision: buyerDecision || existingContact.buyerDecision,
            howMet: howMet || existingContact.howMet,
            notes: notes || existingContact.notes,
          },
          include: {
            pipeline: true,
            contactCompany: true,
          },
        });

        if (pipeline) {
          await prisma.pipeline.upsert({
            where: { contactId: contact.id },
            update: {
              pipeline,
              stage: stage || null,
            },
            create: {
              contactId: contact.id,
              pipeline,
              stage: stage || null,
            },
          });

          contact = await prisma.contact.findUnique({
            where: { id: contact.id },
            include: {
              pipeline: true,
              contactCompany: true,
            },
          });
        }

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
            contactCompanyId: finalContactCompanyId || null,
            buyerDecision: buyerDecision || null,
            howMet: howMet || null,
            notes: notes || null,
            ...(pipeline && {
              pipeline: {
                create: {
                  pipeline,
                  stage: stage || null,
                },
              },
            }),
          },
          include: {
            pipeline: true,
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
          howMet: howMet || null,
          notes: notes || null,
          ...(pipeline && {
            pipeline: {
              create: {
                pipeline,
                stage: stage || null,
              },
            },
          }),
        },
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

