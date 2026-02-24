import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OutreachEmailBuilderService } from '@/lib/services/OutreachEmailBuilderService';
import { PersonaSuggestionService } from '@/lib/services/PersonaSuggestionService';

/**
 * GET /api/public/contacts/[contactId]/detail
 * Public endpoint (no auth) to get contact detail with template
 * 
 * Returns:
 *   - Contact info (name, email)
 *   - Relationship context (from notes)
 *   - Inferred persona
 *   - Generated template
 */
export async function GET(request, { params }) {
  try {
    // Await params in Next.js 15+ App Router
    const resolvedParams = await params;
    const { contactId } = resolvedParams || {};
    
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    // Get contact
    const contact = await prisma.contacts.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        goesBy: true,
        email: true,
        notes: true,
        outreachPersonaSlug: true,
        linkedinUrl: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Get relationship context and persona from notes
    let relationshipContext = null;
    let inferredPersona = null;
    
    if (contact.notes) {
      try {
        const personaResult = await PersonaSuggestionService.suggestPersona(contactId, contact.notes);
        if (personaResult.success) {
          relationshipContext = personaResult.relationshipContext;
          inferredPersona = personaResult.suggestedPersonaSlug;
        }
      } catch (error) {
        console.error('Error getting persona suggestion:', error);
        // Continue without persona - not critical
      }
    }

    // Generate template
    let template = null;
    try {
      const templateResult = await OutreachEmailBuilderService.buildEmail({
        contactId,
        personaSlug: inferredPersona || contact.outreachPersonaSlug || null,
        relationshipContext: relationshipContext || undefined,
      });

      if (templateResult.success) {
        template = {
          subject: templateResult.subject,
          body: templateResult.body,
          emailType: templateResult.emailType,
        };
      }
    } catch (error) {
      console.error('Error generating template:', error);
      // Continue without template - not critical
    }

    return NextResponse.json({
      success: true,
      contact: {
        id: contact.id,
        name: contact.goesBy || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown',
        email: contact.email,
      },
      relationshipContext,
      inferredPersona: inferredPersona || contact.outreachPersonaSlug || null,
      template,
    });
  } catch (error) {
    console.error('Error in public contact detail endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch contact detail',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
