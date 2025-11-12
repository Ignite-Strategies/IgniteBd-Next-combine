import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { enqueueCandidate } from '@/lib/services/enrichment/lushaService';
import { prisma } from '@/lib/prisma';

/**
 * Parse CSV text into array of objects
 * @param {string} csvText - CSV text content
 * @returns {Array<Object>} Array of parsed rows
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  // Parse header
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  
  // Find column indices
  const firstNameIdx = headers.findIndex((h) => 
    h.includes('first') && h.includes('name')
  );
  const lastNameIdx = headers.findIndex((h) => 
    h.includes('last') && h.includes('name')
  );
  const companyIdx = headers.findIndex((h) => 
    h.includes('company')
  );

  if (firstNameIdx === -1 || lastNameIdx === -1 || companyIdx === -1) {
    throw new Error('CSV must contain firstName, lastName, and companyName columns');
  }

  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    if (values.length >= Math.max(firstNameIdx, lastNameIdx, companyIdx) + 1) {
      rows.push({
        firstName: values[firstNameIdx] || null,
        lastName: values[lastNameIdx] || null,
        companyName: values[companyIdx] || null,
      });
    }
  }

  return rows;
}

/**
 * POST /api/enqueue-csv
 * Upload CSV file and enqueue candidates for enrichment
 * 
 * Body: FormData with 'file' field containing CSV file
 * CSV format: firstName,lastName,companyName
 */
export async function POST(request) {
  let userId;
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    userId = firebaseUser.uid;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 },
      );
    }

    // Read file content
    const text = await file.text();
    
    // Parse CSV
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

    // Get companyHQId from query params or body
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId') || formData.get('companyHQId');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Verify companyHQ exists
    const companyHQ = await prisma.companyHQ.findUnique({
      where: { id: companyHQId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    // Enqueue each candidate
    const results = {
      enqueued: 0,
      failed: 0,
      errors: [],
    };

    for (const row of rows) {
      if (!row.firstName || !row.lastName || !row.companyName) {
        results.failed++;
        results.errors.push({
          row,
          error: 'Missing required fields',
        });
        continue;
      }

      try {
        // Create ProspectCandidate record
        const candidate = await prisma.prospectCandidate.create({
          data: {
            userId,
            firstName: row.firstName,
            lastName: row.lastName,
            companyName: row.companyName,
            domain: row.domain || null,
            status: 'pending',
          },
        });

        // Enqueue in Redis
        await enqueueCandidate({
          id: candidate.id,
          userId,
          firstName: row.firstName,
          lastName: row.lastName,
          companyName: row.companyName,
          domain: row.domain || null,
          crmId: companyHQId,
          companyHQId: companyHQId,
        });

        results.enqueued++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          row,
          error: String(err),
        });
        console.error('❌ Error enqueueing candidate:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enqueued ${results.enqueued} candidates`,
      results,
    });
  } catch (error) {
    console.error('❌ Enqueue CSV error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process CSV file' },
      { status: 500 },
    );
  }
}

