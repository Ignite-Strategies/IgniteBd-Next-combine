import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/financials/csv/import
 * Import CSV transactions as expenses/income/equity
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const {
      importId,
      columnMapping,
      importType, // 'expenses', 'income', or 'equity'
      dateFormat = 'YYYY-MM-DD',
    } = body;

    if (!importId || !columnMapping || !importType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get CSV import record
    const csvImport = await prisma.csv_imports.findUnique({
      where: { id: importId },
      include: { financials: true },
    });

    if (!csvImport) {
      return NextResponse.json(
        { success: false, error: 'Import not found' },
        { status: 404 }
      );
    }

    // Update status to PROCESSING
    await prisma.csv_imports.update({
      where: { id: importId },
      data: { status: 'PROCESSING' },
    });

    // TODO: Read CSV file from storage and parse
    // For now, this is a placeholder - you'll need to implement actual CSV parsing
    // based on your storage solution

    // Parse date helper
    const parseDate = (dateStr) => {
      // Simple date parsing - enhance based on dateFormat
      if (dateFormat === 'YYYY-MM-DD') {
        return new Date(dateStr);
      }
      // Add more formats as needed
      return new Date(dateStr);
    };

    // Parse amount helper
    const parseAmount = (amountStr) => {
      const cleaned = amountStr.replace(/[^0-9.-]/g, '');
      const amount = parseFloat(cleaned) * 100; // Convert to cents
      return Math.round(amount);
    };

    // Placeholder for actual CSV parsing
    // You'll need to:
    // 1. Read file from storage (fileUrl)
    // 2. Parse CSV rows
    // 3. Map columns based on columnMapping
    // 4. Create expenses/income/equity records

    const importedCount = 0; // Placeholder

    // Update import status
    await prisma.csv_imports.update({
      where: { id: importId },
      data: {
        status: 'COMPLETED',
        importedCount,
        columnMapping: columnMapping,
      },
    });

    return NextResponse.json({
      success: true,
      importedCount,
      importId,
    });
  } catch (error) {
    console.error('CSV import error:', error);
    
    // Update import status to FAILED
    if (importId) {
      try {
        await prisma.csv_imports.update({
          where: { id: importId },
          data: { status: 'FAILED' },
        });
      } catch (e) {
        console.error('Failed to update import status:', e);
      }
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
