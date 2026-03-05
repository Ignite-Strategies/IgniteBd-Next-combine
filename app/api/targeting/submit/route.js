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

        // Quick signals from the submission form / CSV
        const lastContact     = c.lastContact?.trim() || null;
        const awareOfBusiness = c.awareOfBusiness || null; // 'y' | 'n'
        const usingCompetitor = c.usingCompetitor || null; // 'y' | 'n'
        const workedTogetherAt = c.workedTogetherAt?.trim() || null;
        const priorEngagement = c.priorEngagement || null; // 'y' | 'n'

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

        // Map quick signals → relationship_contexts (plain strings, no enum constraint)
        const hasSignals = lastContact || awareOfBusiness || usingCompetitor || workedTogetherAt || priorEngagement;
        if (hasSignals) {
          // contextOfRelationship: workedTogetherAt wins, then priorEngagement
          const contextOfRelationship = workedTogetherAt
            ? 'PRIOR_COLLEAGUE'
            : priorEngagement === 'y'
            ? 'PRIOR_CLIENT'
            : null;

          // relationshipRecency: map free text → conventional values
          let relationshipRecency = null;
          if (lastContact) {
            const lc = lastContact.toLowerCase();
            if (/week|day|recent|just|new/i.test(lc))          relationshipRecency = 'RECENT';
            else if (/month|quarter|few months/i.test(lc))     relationshipRecency = 'STALE';
            else if (/year|long|while|ages|dormant/i.test(lc)) relationshipRecency = 'LONG_DORMANT';
            else                                                 relationshipRecency = 'STALE'; // fallback for anything unrecognised
          }

          // companyAwareness: competitor overrides aware
          const companyAwareness = usingCompetitor === 'y'
            ? 'KNOWS_COMPANY_COMPETITOR'
            : awareOfBusiness === 'y'
            ? 'KNOWS_COMPANY'
            : awareOfBusiness === 'n'
            ? 'NO_AWARENESS'
            : null;

          const rcData = {
            contactId: contact.id,
            ...(contextOfRelationship && { contextOfRelationship }),
            ...(relationshipRecency    && { relationshipRecency }),
            ...(companyAwareness       && { companyAwareness }),
            ...(workedTogetherAt       && { formerCompany: workedTogetherAt }),
          };

          // Only upsert if we have at least one signal to write
          if (Object.keys(rcData).length > 1) {
            await prisma.relationship_contexts.upsert({
              where: { contactId: contact.id },
              update: rcData,
              create: rcData,
            });
          }
        }

        savedContacts.push({
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          fullName: contact.fullName,
          companyName: contact.companyName,
          title: contact.title,
          howMet: contact.howMet,
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
