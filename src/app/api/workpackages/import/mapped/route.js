import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { hydrateFromMappedCSV } from '@/lib/services/workPackageCsvHydration';

/**
 * POST /api/workpackages/import/mapped
 * Import WorkPackage from CSV using mapped fields
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
    const body = await request.json();
    const {
      contactId,
      companyId,
      workPackage,
      phases,
      transformedRows,
      mappings,
    } = body;

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    if (!workPackage || !phases) {
      return NextResponse.json(
        { success: false, error: 'workPackage and phases are required' },
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

    // Hydrate WorkPackage from mapped data
    const result = await hydrateFromMappedCSV({
      contactId,
      companyId: companyId || null,
      workPackage,
      phases,
      transformedRows,
    });

    console.log('✅ WorkPackage imported from mapped CSV:', result.workPackage.id);

    return NextResponse.json({
      success: true,
      workPackage: result.workPackage,
      stats: result.stats,
    });
  } catch (error) {
    console.error('❌ WorkPackage mapped CSV import error:', error);
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

