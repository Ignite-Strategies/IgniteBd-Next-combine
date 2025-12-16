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

    // Verify contact exists and get company info
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        companies: true, // Get the contact's company
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Auto-populate companyId from contact's company if not provided
    // Work packages should be assigned to companies, not just contacts
    let finalCompanyId = companyId;
    if (!finalCompanyId && contact.companies) {
      finalCompanyId = contact.companies.id;
      console.log(`📦 Auto-assigned companyId from contact: ${finalCompanyId}`);
    } else if (!finalCompanyId && contact.contactCompanyId) {
      // Fallback: use contactCompanyId if companies relation didn't load
      finalCompanyId = contact.contactCompanyId;
      console.log(`📦 Auto-assigned companyId from contactCompanyId: ${finalCompanyId}`);
    }

    if (!finalCompanyId) {
      console.warn('⚠️ Work package created without companyId - contact has no associated company');
    }

    // Hydrate WorkPackage from mapped data
    const result = await hydrateFromMappedCSV({
      contactId,
      companyId: finalCompanyId || null,
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

