import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { parseCSV } from '@/lib/services/csvMappers';
import {
  validatePhaseCsvHeaders,
  validateDeliverableCsvHeaders,
} from '@/lib/services/csvValidator';

/**
 * POST /api/csv/validate
 * Validate CSV headers and return preview data
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
    const uploadType = formData.get('uploadType'); // 'phase' or 'deliverable'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'CSV file is required' },
        { status: 400 },
      );
    }

    if (!uploadType || !['phase', 'deliverable'].includes(uploadType)) {
      return NextResponse.json(
        { success: false, error: 'uploadType must be "phase" or "deliverable"' },
        { status: 400 },
      );
    }

    // Read and parse CSV
    const text = await file.text();
    let rows;
    try {
      rows = parseCSV(text);
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: `CSV parsing error: ${parseError.message}` },
        { status: 400 },
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid rows found in CSV' },
        { status: 400 },
      );
    }

    // Get headers from first row
    const headers = Object.keys(rows[0]);

    // Validate headers
    const validation =
      uploadType === 'phase'
        ? validatePhaseCsvHeaders(headers)
        : validateDeliverableCsvHeaders(headers);

    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: 'CSV validation failed',
        validation,
        headers,
      });
    }

    // Get preview data (first 5 rows)
    const previewRows = rows.slice(0, 5);

    // For deliverable CSV, calculate phase → deliverables count
    let phaseDeliverableCounts = null;
    if (uploadType === 'deliverable') {
      const counts = {};
      rows.forEach((row) => {
        const phaseName = row['Phase Name'] || row['phase name'] || 'Unknown';
        counts[phaseName] = (counts[phaseName] || 0) + 1;
      });
      phaseDeliverableCounts = counts;
    }

    return NextResponse.json({
      success: true,
      headers,
      totalRows: rows.length,
      previewRows,
      validation,
      phaseDeliverableCounts,
    });
  } catch (error) {
    console.error('❌ CSV Validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate CSV',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

