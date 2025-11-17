import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { parseCSV, normalizeWorkPackageCSVRow } from '@/lib/utils/csv';
import { hydrateWorkPackageFromCSV } from '@/lib/services/workpackageHydrationService';

/**
 * POST /api/workpackages/import/one-shot
 * One-shot CSV import - fully hydrates WorkPackage with phases and items
 */
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
    const formData = await request.formData();
    const file = formData.get('file');
    const contactId = formData.get('contactId');
    const companyId = formData.get('companyId');
    const title = formData.get('title') || 'Imported Work Package';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'CSV file is required' },
        { status: 400 },
      );
    }

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Parse CSV
    const csvText = await file.text();
    const parsed = parseCSV(csvText);

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'CSV parsing errors', errors: parsed.errors },
        { status: 400 },
      );
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file contains no data rows' },
        { status: 400 },
      );
    }

    // Normalize rows
    const normalizedRows = [];
    const errors = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const normalized = normalizeWorkPackageCSVRow(row);

      if (!normalized) {
        errors.push(`Row ${i + 2}: Invalid or missing required fields`);
        continue;
      }

      normalizedRows.push(normalized);
    }

    if (errors.length > 0 && normalizedRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'All rows failed validation', errors },
        { status: 400 },
      );
    }

    if (normalizedRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid rows found in CSV' },
        { status: 400 },
      );
    }

    // Extract proposal title from first row description or use provided title
    const proposalTitle = title || normalizedRows[0].proposalDescription || 'Imported Work Package';

    // Hydrate WorkPackage
    const result = await hydrateWorkPackageFromCSV({
      contactId,
      companyId: companyId || null,
      title: proposalTitle,
      rows: normalizedRows,
    });

    // Fetch created work package with relations
    const workPackage = await prisma.workPackage.findUnique({
      where: { id: result.workPackageId },
      include: {
        phases: {
          include: {
            items: true,
          },
          orderBy: { position: 'asc' },
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    console.log('✅ WorkPackage imported from CSV:', result.workPackageId);

    return NextResponse.json({
      success: true,
      workPackage,
      summary: {
        workPackageId: result.workPackageId,
        phasesCreated: result.phasesCreated,
        phasesUpdated: result.phasesUpdated,
        itemsCreated: result.itemsCreated,
        itemsUpdated: result.itemsUpdated,
        totalEstimatedHours: result.totalEstimatedHours,
        warnings: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('❌ WorkPackage CSV import error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to import WorkPackage from CSV',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

