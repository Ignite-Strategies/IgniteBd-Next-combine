import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/** CSV columns matching upload template so export can be re-uploaded */
const CSV_HEADERS = [
  'First Name',
  'Last Name',
  'Email Address',
  'Company',
  'Position',
  'URL',
  'Connected On',
  'Phone',
  'Notes',
  'Pipeline',
  'Stage',
];

function escapeCsvCell(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * GET /api/contacts/export?companyHQId=...
 * Returns CSV of all contacts for the company (same columns as upload template).
 * Use Accept: text/csv or ?format=csv. Requires auth and membership.
 */
export async function GET(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const companyHQId = searchParams.get('companyHQId');
  if (!companyHQId) {
    return NextResponse.json(
      { success: false, error: 'companyHQId is required' },
      { status: 400 },
    );
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
    return NextResponse.json(
      { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
      { status: 403 },
    );
  }

  const contacts = await prisma.contact.findMany({
    where: { crmId: companyHQId },
    include: {
      pipelines: true,
      companies: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const headerLine = CSV_HEADERS.join(',');
  const rows = contacts.map((c) => {
    const companyName = c.companies?.companyName ?? c.companyName ?? '';
    const pipeline = c.pipelines?.pipeline ?? '';
    const stage = c.pipelines?.stage ?? '';
    return [
      escapeCsvCell(c.firstName),
      escapeCsvCell(c.lastName),
      escapeCsvCell(c.email),
      escapeCsvCell(companyName),
      escapeCsvCell(c.title),
      escapeCsvCell(c.linkedinUrl),
      escapeCsvCell(c.linkedinConnectedOn),
      escapeCsvCell(c.phone),
      escapeCsvCell(c.notes),
      escapeCsvCell(pipeline),
      escapeCsvCell(stage),
    ].join(',');
  });
  const csv = [headerLine, ...rows].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contacts_export_${companyHQId.slice(0, 8)}.csv"`,
    },
  });
}
