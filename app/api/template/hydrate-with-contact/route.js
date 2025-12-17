import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { hydrateTemplate, validateHydration } from '@/lib/templateVariables';

export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { 
      templateId, 
      contactId, 
      metadata = {} // Additional context like desiredOutcome, timeHorizon, etc.
    } = body ?? {};

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 },
      );
    }

    // Fetch the template
    const template = await prisma.outreach_templates.findUnique({
      where: { id: templateId },
      include: {
        template_bases: true,
        template_variables: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 },
      );
    }

    let contactData = {};
    
    // If contactId provided, fetch contact data
    if (contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          firstName: true,
          lastName: true,
          fullName: true,
          goesBy: true,
          email: true,
          title: true,
          companyName: true,
          companyDomain: true,
          updatedAt: true,
          createdAt: true,
        },
      });

      if (!contact) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 },
        );
      }

      contactData = contact;
    }

    // Hydrate the template with contact data + metadata
    const hydratedContent = hydrateTemplate(template.content, contactData, metadata);

    // Validate hydration
    const validation = validateHydration(hydratedContent);

    return NextResponse.json({
      success: true,
      hydratedContent,
      originalTemplate: template.content,
      validation,
      contactData: contactId ? contactData : null,
      metadata,
    });
  } catch (error) {
    console.error('❌ Template hydrate with contact error:', error);
    return NextResponse.json(
      { error: 'Failed to hydrate template with contact data' },
      { status: 500 },
    );
  }
}
