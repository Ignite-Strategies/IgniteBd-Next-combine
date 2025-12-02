import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { runEcosystemOrgInference } from '@/lib/services/ecosystemOrgInference';
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

    // Map CSV rows to org format
    // Expected columns: Firm/Org Name, Website, Org Location
    return rows.map((row: any) => {
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

  // Handle Excel files
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls')
  ) {
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet);

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
      throw new Error('Excel file parsing failed: ' + (error as Error).message);
    }
  }

  throw new Error('Unsupported file type. Please upload a CSV or Excel (.xlsx, .xls) file.');
}

/**
 * Parse text list (one org per line)
 */
function parseTextList(text: string): Array<{ name: string; website?: string; location?: string }> {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => {
    // Try to parse: "Name | Website | Location" or just "Name"
    const parts = line.split('|').map((p) => p.trim());
    return {
      name: parts[0] || line,
      website: parts[1] || undefined,
      location: parts[2] || undefined,
    };
  });
}

/**
 * POST /api/ecosystem/org/ingest
 * Accept CSV/XLSX, text list, or single manual entry
 * Upload and create EcosystemOrg records with AI inference
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    let parsedRows: Array<{ name: string; website?: string; location?: string }> = [];

    // Handle form data (file upload or single entry)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const name = formData.get('name') as string | null;
      const website = formData.get('website') as string | null;
      const location = formData.get('location') as string | null;
      const textList = formData.get('textList') as string | null;

      if (file) {
        // File upload (CSV/XLSX)
        parsedRows = await parseFile(file);
      } else if (textList) {
        // Text list (one per line)
        parsedRows = parseTextList(textList);
      } else if (name) {
        // Single manual entry
        parsedRows = [
          {
            name: name.trim(),
            website: website?.trim() || undefined,
            location: location?.trim() || undefined,
          },
        ];
      } else {
        return NextResponse.json({ success: false, error: 'File, textList, or name is required' }, { status: 400 });
      }
    } else {
      // Handle JSON body (single entry or array)
      const body = await request.json();

      if (Array.isArray(body)) {
        parsedRows = body;
      } else if (body.name) {
        parsedRows = [
          {
            name: body.name,
            website: body.website,
            location: body.location,
          },
        ];
      } else {
        return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
      }
    }

    if (parsedRows.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid rows found' }, { status: 400 });
    }

    // Filter out rows with missing name
    const validRows = parsedRows.filter((row) => row.name && row.name.trim().length > 0);

    if (validRows.length === 0) {
      return NextResponse.json({ success: false, error: 'No rows with valid organization names found' }, { status: 400 });
    }

    console.log(`📊 Processing ${validRows.length} ecosystem orgs...`);

    // Process each row: create record → run inference → update
    const results = [];
    const errors = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        // Check if org already exists by normalized name (fuzzy match could be added later)
        const existing = await prisma.ecosystemOrg.findFirst({
          where: {
            normalizedName: {
              equals: row.name,
              mode: 'insensitive',
            },
          },
        });

        if (existing) {
          console.log(`⚠️  Org already exists: ${row.name}, skipping`);
          results.push(existing);
          continue;
        }

        // Create initial record with raw data
        const ecosystemOrg = await prisma.ecosystemOrg.create({
          data: {
            sourceType: 'CSV',
            rawName: row.name,
            rawWebsite: row.website,
            rawLocation: row.location,
            normalizedName: row.name, // Temporary, will be updated after inference
            organizationType: 'COMMERCIAL', // Default, will be updated after inference
            industryTags: [],
            memberTypes: [],
          },
        });

        // Run AI inference
        let inferenceResult;
        try {
          inferenceResult = await runEcosystemOrgInference({
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
        const updated = await prisma.ecosystemOrg.update({
          where: { id: ecosystemOrg.id },
          data: {
            normalizedName: inferenceResult.normalizedName,
            organizationType: inferenceResult.organizationType,
            description: inferenceResult.description || null,
            whatTheyDo: inferenceResult.whatTheyDo || null,
            howTheyMatter: inferenceResult.howTheyMatter || null,
            industryTags: inferenceResult.industryTags,
            memberTypes: inferenceResult.memberTypes,
            authorityLevel: inferenceResult.authorityLevel,
            sizeEstimate: inferenceResult.sizeEstimate || null,
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
      orgs: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('❌ Ecosystem org ingest error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to ingest ecosystem orgs',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ecosystem/org/ingest
 * Get all ecosystem orgs
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
    const organizationType = searchParams.get('organizationType') as
      | 'ASSOCIATION'
      | 'COMMERCIAL'
      | 'MEDIA'
      | 'NONPROFIT'
      | 'GOVERNMENT'
      | null;

    const where: any = {};
    if (organizationType) {
      where.organizationType = organizationType;
    }

    const orgs = await prisma.ecosystemOrg.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      count: orgs.length,
      orgs,
    });
  } catch (error) {
    console.error('❌ Get ecosystem orgs error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ecosystem orgs',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

