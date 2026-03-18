import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';
import { ensureContactPipeline } from '@/lib/services/pipelineService';

/**
 * POST /api/targeting/bulk-create
 *
 * Phase 1 only: create/update contacts with identity fields only (no FKs).
 * Returns contact IDs for downstream hydration (engagement log, suggest-persona).
 *
 * Body: { companyHQId: string, contacts: [{ name?, company?, title?, email?, linkedin? }] }
 * Returns: { success, contacts: [{ id, firstName, lastName, companyName, isNew }], created, updated, errors }
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
      console.error('[bulk-create] Missing companyHQId for uid:', firebaseUser.uid);
      return NextResponse.json({ success: false, error: 'companyHQId is required' }, { status: 400 });
    }
    if (!Array.isArray(contacts) || contacts.length === 0) {
      console.error('[bulk-create] Empty contacts array for companyHQId:', companyHQId);
      return NextResponse.json({ success: false, error: 'contacts array is required' }, { status: 400 });
    }

    console.log(`[bulk-create] uid=${firebaseUser.uid} companyHQId=${companyHQId} count=${contacts.length}`);

    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });
    if (!owner) {
      console.error('[bulk-create] Owner not found for uid:', firebaseUser.uid);
      return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
    }

    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      console.error(`[bulk-create] Forbidden: owner ${owner.id} has no membership for companyHQId ${companyHQId}`);
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const company = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
      select: { id: true },
    });
    if (!company) {
      console.error('[bulk-create] Company not found:', companyHQId);
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const results = { created: 0, updated: 0, errors: [] };
    const savedContacts = []; // same length as contacts; null for skipped

    for (const [idx, c] of contacts.entries()) {
      try {
        let firstName = (c.firstName || '').trim();
        let lastName = (c.lastName || '').trim();
        if (!firstName && !lastName && c.name) {
          const parts = (c.name || '').trim().split(/\s+/);
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }
        if (!firstName && !lastName) {
          results.errors.push(`Contact ${idx + 1}: name is required`);
          savedContacts.push(null);
          continue;
        }

        const email = (c.email || '').trim() || null;
        const companyName = (c.company || c.companyName || '').trim() || null;
        const title = (c.title || '').trim() || null;
        const linkedinUrl = (c.linkedin || c.linkedinUrl || '').trim() || null;
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;

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
              outreachIntent: 'TARGET',
              ...(email && { email }),
              ...(companyName && { companyName }),
              ...(title && { title }),
              ...(linkedinUrl && { linkedinUrl }),
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
              outreachIntent: 'TARGET',
              ...(email && { email }),
              ...(companyName && { companyName }),
              ...(title && { title }),
              ...(linkedinUrl && { linkedinUrl }),
            },
          });
          results.created++;
        }

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
          isNew: !existing,
        });
      } catch (err) {
        console.error(`[bulk-create] Error on contact ${idx + 1}:`, err.message, err.stack);
        results.errors.push(`Contact ${idx + 1}: ${err.message}`);
        savedContacts.push(null);
      }
    }

    console.log(`[bulk-create] Done: created=${results.created} updated=${results.updated} errors=${results.errors.length}`);
    if (results.errors.length > 0) {
      console.error('[bulk-create] Per-contact errors:', results.errors);
    }

    return NextResponse.json({
      success: true,
      created: results.created,
      updated: results.updated,
      errors: results.errors,
      total: contacts.length,
      contacts: savedContacts,
      message: `Created/updated ${savedContacts.length} contacts (${results.created} new, ${results.updated} updated). Hydrate engagement log and persona per contact.`,
    });
  } catch (error) {
    console.error('[bulk-create] Unhandled error:', error.message, error.stack);
    return NextResponse.json(
      { success: false, error: 'Failed to bulk-create targets', details: error.message },
      { status: 500 },
    );
  }
}
