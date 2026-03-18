import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { synthesizeContactSummary } from '@/lib/services/synthesizeContactSummaryService';

const VALID_ENTRY_TYPES = ['INITIAL', 'POST_CALL', 'POST_MEETING'];

/**
 * GET /api/contacts/[contactId]/engagement-log
 * Returns all log entries for a contact ordered by most recent first.
 */
export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { contactId } = await params;

  const entries = await prisma.contact_engagement_log.findMany({
    where: { contactId },
    orderBy: { loggedAt: 'desc' },
    select: {
      id: true,
      entryType: true,
      note: true,
      loggedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, entries });
}

/**
 * POST /api/contacts/[contactId]/engagement-log
 * Create an engagement log entry.
 * INITIAL = from bulk-create hydrate (notes + signals). POST_CALL/POST_MEETING = manual.
 * Fires synthesizeContactSummary in the background after save.
 *
 * Body: { entryType: 'INITIAL' | 'POST_CALL' | 'POST_MEETING', note: string, loggedAt?: string }
 */
export async function POST(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { contactId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { entryType, note, loggedAt } = body ?? {};

  if (!VALID_ENTRY_TYPES.includes(entryType)) {
    return NextResponse.json(
      { success: false, error: `entryType must be one of: ${VALID_ENTRY_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  if (!note?.trim()) {
    return NextResponse.json({ success: false, error: 'note is required' }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true },
  });
  if (!contact) {
    return NextResponse.json({ success: false, error: 'Contact not found' }, { status: 404 });
  }

  const entry = await prisma.contact_engagement_log.create({
    data: {
      contactId,
      entryType,
      note: note.trim(),
      ...(loggedAt ? { loggedAt: new Date(loggedAt) } : {}),
    },
  });

  // Regenerate contactSummary before responding (serverless context dies after response)
  await synthesizeContactSummary(contactId).catch((err) =>
    console.error(`synthesizeContactSummary failed for ${contactId}:`, err),
  );

  return NextResponse.json({ success: true, entry });
}
