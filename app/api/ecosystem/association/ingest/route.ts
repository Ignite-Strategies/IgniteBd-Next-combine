import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { runAssociationInference } from '@/lib/services/associationInference';
import { parseCSV } from '@/lib/services/csvMappers';

/**
 * Parse Excel/CSV file into rows
 */
async function parseFile(file: File): Promise<Array<{ name: string; website?: string; location?: string }>> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  // Handle CSV
  if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
    const text = await file.text();
    const rows = parseCSV(text);

    // Map CSV rows to association format
    // Expected columns: Firm/Org Name, Website, Org Location
    return rows.map((row: any) => {
      // Case-insensitive column matching
      const nameKey = Object.keys(row).find(
        (k) => k.toLowerCase().includes('firm') || k.toLowerCase().includes('org') || k.toLowerCase().includes('name')
      );
      const websiteKey = Object.keys(row).find((k) => k.toLowerCase().includes('website') || k.toLowerCase().includes('url'));
      const locationKey = Object.keys(row).find(
        (k) => k.toLowerCase().includes('location') || k.toLowerCase().includes('loc')
      );

      return {
        name: (nameKey ? row[nameKey] : '').trim(),
        website: websiteKey ? (row[websiteKey] || '').trim() || undefined : undefined,
        location: locationKey ? (row[locationKey] || '').trim() || undefined : undefined,
      };
    });
  }

  // Handle Excel files - require xlsx package
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls')
  ) {
    // Dynamic import for xlsx (install with: npm install xlsx)
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      // Map Excel rows to association format
      return rows.map((row: any) => {
        const nameKey = Object.keys(row).find(
          (k) => k.toLowerCase().includes('firm') || k.toLowerCase().includes('org') || k.toLowerCase().includes('name')
        );
        const websiteKey = Object.keys(row).find((k) => k.toLowerCase().includes('website') || k.toLowerCase().includes('url'));
        const locationKey = Object.keys(row).find(
          (k) => k.toLowerCase().includes('location') || k.toLowerCase().includes('loc')
        );

        return {
          name: (nameKey ? row[nameKey] : '').toString().trim(),
          website: websiteKey ? (row[websiteKey] || '').toString().trim() || undefined : undefined,
          location: locationKey ? (row[locationKey] || '').toString().trim() || undefined : undefined,
        };
      });
    } catch (error) {
      throw new Error(
        'Excel file parsing failed. Please install xlsx package: npm install xlsx. Error: ' + (error as Error).message
      );
    }
  }

  throw new Error('Unsupported file type. Please upload a CSV or Excel (.xlsx, .xls) file.');
}

/**
 * POST /api/ecosystem/association/ingest
 * Upload CSV/XLSX file and create AssociationIngest records with AI inference
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 });
    }

    // Parse file
    let parsedRows;
    try {
      parsedRows = await parseFile(file);
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: `File parsing error: ${(parseError as Error).message}` },
        { status: 400 }
      );
    }

    if (parsedRows.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid rows found in file' }, { status: 400 });
    }

    // Filter out rows with missing name
    const validRows = parsedRows.filter((row) => row.name && row.name.trim().length > 0);

    if (validRows.length === 0) {
      return NextResponse.json({ success: false, error: 'No rows with valid organization names found' }, { status: 400 });
    }

    console.log(`📊 Processing ${validRows.length} associations...`);

    // Process each row: create record → run inference → update
    const results = [];
    const errors = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        // Create initial record with raw data
        const associationIngest = await prisma.associationIngest.create({
          data: {
            rawName: row.name,
            rawWebsite: row.website,
            rawLocation: row.location,
            normalizedName: row.name, // Temporary, will be updated after inference
            industryTags: [],
            memberTypes: [],
            ecosystemType: 'ASSOCIATION',
          },
        });

        // Run AI inference
        let inferenceResult;
        try {
          inferenceResult = await runAssociationInference({
            name: row.name,
            website: row.website,
            location: row.location,
          });
        } catch (inferenceError) {
          console.error(`❌ Inference failed for ${row.name}:`, inferenceError);
          errors.push({ row: i + 1, name: row.name, error: (inferenceError as Error).message });
          continue;
        }

        // Update record with inferred data
        const updated = await prisma.associationIngest.update({
          where: { id: associationIngest.id },
          data: {
            normalizedName: inferenceResult.normalizedName,
            description: inferenceResult.description || null,
            missionSummary: inferenceResult.missionSummary || null,
            industryTags: inferenceResult.industryTags,
            memberTypes: inferenceResult.memberTypes,
            memberSeniority: inferenceResult.memberSeniority || null,
            authorityLevel: inferenceResult.authorityLevel,
            valueProposition: inferenceResult.valueProposition || null,
            personaAlignment: inferenceResult.personaAlignment || null,
            bdRelevanceScore: inferenceResult.bdRelevanceScore || null,
          },
        });

        results.push(updated);
        console.log(`✅ Processed ${i + 1}/${validRows.length}: ${row.name}`);
      } catch (error) {
        console.error(`❌ Failed to process ${row.name}:`, error);
        errors.push({ row: i + 1, name: row.name, error: (error as Error).message });
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      associations: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('❌ Association ingest error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to ingest associations',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ecosystem/association/ingest
 * Get all association ingests
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const associations = await prisma.associationIngest.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      count: associations.length,
      associations,
    });
  } catch (error) {
    console.error('❌ Get associations error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch associations',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

