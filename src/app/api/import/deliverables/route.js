import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/import/deliverables
 * Import Deliverable Templates from CSV
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
    const companyHQId = formData.get('companyHQId');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'CSV file is required' },
        { status: 400 },
      );
    }

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Read CSV file
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'CSV must have at least a header and one data row' },
        { status: 400 },
      );
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredColumns = ['deliverabletype', 'deliverablelabel', 'defaultunitofmeasure', 'defaultduration'];
    
    // Validate columns
    const missingColumns = requiredColumns.filter(col => !header.includes(col));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required columns: ${missingColumns.join(', ')}` },
        { status: 400 },
      );
    }

    // Parse and upsert rows
    const results = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, '')); // Remove quotes
      const row = {};
      header.forEach((col, idx) => {
        row[col] = values[idx] || '';
      });
      
      const deliverableType = row.deliverabletype;
      const deliverableLabel = row.deliverablelabel;
      const defaultUnitOfMeasure = row.defaultunitofmeasure?.toLowerCase();
      const defaultDuration = parseInt(row.defaultduration) || 1;

      if (!deliverableType || !deliverableLabel || !defaultUnitOfMeasure) {
        continue; // Skip invalid rows
      }

      // Validate unit of measure
      if (!['day', 'week', 'month'].includes(defaultUnitOfMeasure)) {
        continue; // Skip rows with invalid unit of measure
      }

      // Upsert deliverable template (unique by companyHQId + deliverableType)
      const deliverableTemplate = await prisma.deliverableTemplate.upsert({
        where: {
          companyHQId_deliverableType: {
            companyHQId,
            deliverableType,
          },
        },
        update: {
          deliverableLabel,
          defaultUnitOfMeasure: defaultUnitOfMeasure,
          defaultDuration,
        },
        create: {
          companyHQId,
          deliverableType,
          deliverableLabel,
          defaultUnitOfMeasure: defaultUnitOfMeasure,
          defaultDuration,
        },
      });

      results.push(deliverableTemplate);
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      deliverableTemplates: results,
    });
  } catch (error) {
    console.error('❌ ImportDeliverables error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import deliverables',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

