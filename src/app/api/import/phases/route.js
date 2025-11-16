import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/import/phases
 * Import Phase Templates from CSV
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

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'CSV file is required' },
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
    const requiredColumns = ['phasename'];
    
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
      
      const phaseName = row.phasename;
      const phaseDescription = row.phasedescription || null;

      if (!phaseName) {
        continue; // Skip empty rows
      }

      // Upsert phase template
      const phaseTemplate = await prisma.phaseTemplate.upsert({
        where: { name: phaseName },
        update: {
          description: phaseDescription,
        },
        create: {
          name: phaseName,
          description: phaseDescription,
        },
      });

      results.push(phaseTemplate);
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      phaseTemplates: results,
    });
  } catch (error) {
    console.error('❌ ImportPhases error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import phases',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

