import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';
import { ensureContactPipeline } from '@/lib/services/pipelineService';

/**
 * POST /api/targeting/submit
 * Save a batch of contacts as Targets (outreachIntent = TARGET).
 *
 * Body (JSON):
 * {
 *   companyHQId: string,
 *   contacts: [
 *     {
 *       name?: string,          // "First Last" — split into firstName/lastName
 *       firstName?: string,
 *       lastName?: string,
 *       company?: string,
 *       title?: string,
 *       linkedin?: string,
 *       relationship?: string,  // free-text relationship context → stored in howMet
 *       notes?: string,
 *       email?: string,
 *     }
 *   ]
 * }
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { contacts, companyHQId } = body ?? {};

    if (!companyHQId) {
      return NextResponse.json({ success: false, error: 'companyHQId is required' }, { status: 400 });
    }
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ success: false, error: 'contacts array is required' }, { status: 400 });
    }

    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
    }

    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const company = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const results = { created: 0, updated: 0, errors: [] };
    const savedContacts = [];

    for (const [idx, c] of contacts.entries()) {
      try {
        // Resolve firstName / lastName
        let firstName = (c.firstName || '').trim();
        let lastName = (c.lastName || '').trim();

        if (!firstName && !lastName && c.name) {
          const parts = c.name.trim().split(/\s+/);
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }

        if (!firstName && !lastName) {
          results.errors.push(`Contact ${idx + 1}: name is required`);
          continue;
        }

        const email = c.email?.trim() || null;
        const companyName = (c.company || c.companyName || '').trim() || null;
        const title = c.title?.trim() || null;
        const linkedinUrl = (c.linkedin || c.linkedinUrl || '').trim() || null;
        const howMet = (c.relationship || c.howMet || '').trim() || null;
        const notes = c.notes?.trim() || null;
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;

        // Try to find existing contact: email match first, then name match
        let existing = null;
        if (email) {
          existing = await prisma.contact.findFirst({
            where: { crmId: companyHQId, email },
            select: { id: true },
          });
        }
        if (!existing && firstName) {
          existing = await prisma.contact.findFirst({
            where: {
              crmId: companyHQId,
              firstName,
              ...(lastName ? { lastName } : {}),
            },
            select: { id: true },
          });
        }

        let contact;

        if (existing) {
          contact = await prisma.contact.update({
            where: { id: existing.id },
            data: {
              firstName,
              lastName,
              fullName,
              ...(email && { email }),
              ...(companyName && { companyName }),
              ...(title && { title }),
              ...(linkedinUrl && { linkedinUrl }),
              ...(howMet && { howMet }),
              ...(notes && { notes }),
              outreachIntent: 'TARGET',
            },
          });
          results.updated++;
        } else {
          contact = await prisma.contact.create({
            data: {
              crmId: companyHQId,
              firstName,
              lastName,
              fullName,
              ...(email && { email }),
              ...(companyName && { companyName }),
              ...(title && { title }),
              ...(linkedinUrl && { linkedinUrl }),
              ...(howMet && { howMet }),
              ...(notes && { notes }),
              outreachIntent: 'TARGET',
            },
          });
          results.created++;
        }

        // Ensure pipeline record (prospect / need-to-engage)
        await ensureContactPipeline(contact.id, {
          pipeline: 'prospect',
          stage: 'need-to-engage',
          defaultPipeline: 'prospect',
          defaultStage: 'need-to-engage',
        });

        savedContacts.push({
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          fullName: contact.fullName,
          companyName: contact.companyName,
          title: contact.title,
          howMet: contact.howMet,
          outreachIntent: contact.outreachIntent,
        });
      } catch (err) {
        console.error(`Error saving target ${idx + 1}:`, err);
        results.errors.push(`Contact ${idx + 1}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      created: results.created,
      updated: results.updated,
      errors: results.errors,
      total: contacts.length,
      savedContacts,
      message: `Saved ${results.created + results.updated} targets (${results.created} new, ${results.updated} updated)`,
    });
  } catch (error) {
    console.error('❌ TargetingSubmit error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit targets', details: error.message },
      { status: 500 },
    );
  }
}
