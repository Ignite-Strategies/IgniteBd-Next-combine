import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/financials/csv/upload
 * Upload CSV file for financial import
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
    const formData = await request.formData();
    const file = formData.get('file');
    const companyHQId = formData.get('companyHQId');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'CSV file is required' },
        { status: 400 }
      );
    }

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (
      file.type !== 'text/csv' &&
      !file.name.toLowerCase().endsWith('.csv')
    ) {
      return NextResponse.json(
        { success: false, error: 'File must be a CSV file' },
        { status: 400 }
      );
    }

    // Get or create financials record
    let financials = await prisma.financials.findUnique({
      where: { companyHQId },
    });

    if (!financials) {
      financials = await prisma.financials.create({
        data: { companyHQId },
      });
    }

    // TODO: Upload file to storage (S3, etc.)
    // For now, store file info
    const fileUrl = `temp/${file.name}`; // Placeholder

    // Parse CSV to get row count and preview
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const rowCount = lines.length - 1; // Exclude header

    // Create CSV import record
    const csvImport = await prisma.csv_imports.create({
      data: {
        financialsId: financials.id,
        fileName: file.name,
        fileUrl,
        rowCount,
        status: 'PENDING',
      },
    });

    // Parse first 10 rows for preview
    const previewRows = [];
    const headers = lines[0]?.split(',').map(h => h.trim()) || [];
    
    for (let i = 1; i < Math.min(11, lines.length); i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      previewRows.push(row);
    }

    return NextResponse.json({
      success: true,
      importId: csvImport.id,
      fileName: file.name,
      rowCount,
      preview: previewRows,
      headers,
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
