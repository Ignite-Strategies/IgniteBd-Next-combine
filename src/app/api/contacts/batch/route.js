import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { parseCSV } from '@/lib/utils/csv';
import { findOrCreateCompanyByDomain } from '@/lib/services/companyService';
import { ensureContactPipeline } from '@/lib/services/pipelineService';

/**
 * POST /api/contacts/batch
 * Batch create contacts with company association and pipeline setup
 * Processes CSV with all data at once (HubSpot-style)
 * 
 * Body: FormData with 'file' field containing CSV
 * CSV format:
 * - firstName, lastName (required)
 * - email, phone, title, goesBy, notes, howMet (optional)
 * - companyName, companyDomain (optional - for company association)
 * - pipeline, stage (optional - for pipeline setup)
 * 
 * Returns:
 * - success: boolean
 * - created: number of contacts created
 * - updated: number of contacts updated
 * - companiesCreated: number of companies created
 * - companiesFound: number of companies found
 * - errors: array of error messages
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

    // Verify companyHQ exists
    const companyHQ = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    // Parse CSV
    const csvText = await file.text();
    const parsed = parseCSV(csvText);

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'CSV parsing errors', errors: parsed.errors },
        { status: 400 },
      );
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file contains no data rows' },
        { status: 400 },
      );
    }

    // Normalize headers (case-insensitive matching)
    const normalizeHeader = (header) => {
      const normalized = header.toLowerCase().trim();
      const mappings = {
        'first name': 'firstName',
        'firstname': 'firstName',
        'first': 'firstName',
        'last name': 'lastName',
        'lastname': 'lastName',
        'last': 'lastName',
        'goes by': 'goesBy',
        'goesby': 'goesBy',
        'preferred name': 'goesBy',
        'email': 'email',
        'phone': 'phone',
        'title': 'title',
        'job title': 'title',
        'jobtitle': 'title',
        'company name': 'companyName',
        'companyname': 'companyName',
        'company': 'companyName',
        'company domain': 'companyDomain',
        'companydomain': 'companyDomain',
        'domain': 'companyDomain',
        'website': 'companyDomain',
        'pipeline': 'pipeline',
        'stage': 'stage',
        'notes': 'notes',
        'how met': 'howMet',
        'howmet': 'howMet',
      };
      return mappings[normalized] || normalized;
    };

    // Process each row
    const results = {
      created: 0,
      updated: 0,
      companiesCreated: 0,
      companiesFound: 0,
      errors: [],
    };

    // Get all existing companies for this tenant (for faster lookup)
    const existingCompanies = await prisma.companies.findMany({
      where: { companyHQId },
    });
    const companyMap = new Map();
    existingCompanies.forEach((c) => {
      if (c.companyName) {
        companyMap.set(c.companyName.toLowerCase().trim(), c);
      }
      if (c.domain) {
        companyMap.set(c.domain.toLowerCase().trim(), c);
      }
    });

    // Process rows in sequence (to handle dependencies)
    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const rowNum = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

      try {
        // Normalize row data
        const normalizedRow = {};
        Object.keys(row).forEach((key) => {
          const normalizedKey = normalizeHeader(key);
          normalizedRow[normalizedKey] = row[key]?.trim() || '';
        });

        // Validate required fields
        if (!normalizedRow.firstName || !normalizedRow.lastName) {
          results.errors.push(`Row ${rowNum}: First Name and Last Name are required`);
          continue;
        }

        // Extract contact data
        const contactData = {
          firstName: normalizedRow.firstName,
          lastName: normalizedRow.lastName,
          goesBy: normalizedRow.goesBy || null,
          email: normalizedRow.email ? normalizedRow.email.toLowerCase().trim() : null,
          phone: normalizedRow.phone || null,
          title: normalizedRow.title || null,
          notes: normalizedRow.notes || null,
          howMet: normalizedRow.howMet || null,
        };

        // Step 1: Create or update contact
        let contact;
        if (contactData.email) {
          // Check for existing contact by email
          const existingContact = await prisma.contact.findFirst({
            where: {
              crmId: companyHQId,
              email: contactData.email,
            },
          });

          if (existingContact) {
            // Update existing contact
            contact = await prisma.contact.update({
              where: { id: existingContact.id },
              data: {
                firstName: contactData.firstName,
                lastName: contactData.lastName,
                goesBy: contactData.goesBy,
                phone: contactData.phone,
                title: contactData.title,
                notes: contactData.notes,
                howMet: contactData.howMet,
              },
            });
            results.updated++;
          } else {
            // Create new contact
            contact = await prisma.contact.create({
              data: {
                crmId: companyHQId,
                ...contactData,
              },
            });
            results.created++;
          }
        } else {
          // Create contact without email
          contact = await prisma.contact.create({
            data: {
              crmId: companyHQId,
              ...contactData,
            },
          });
          results.created++;
        }

        // Step 2: Handle company association
        let companyId = null;
        if (normalizedRow.companyName || normalizedRow.companyDomain) {
          const companyName = normalizedRow.companyName?.trim();
          const companyDomain = normalizedRow.companyDomain?.trim() || 
            (contactData.email && contactData.email.includes('@') 
              ? contactData.email.split('@')[1].toLowerCase() 
              : null);

          // Try to find existing company
          let company = null;
          if (companyName) {
            const normalizedName = companyName.toLowerCase().trim();
            company = existingCompanies.find(
              (c) => c.companyName && c.companyName.toLowerCase().trim() === normalizedName
            );
          }

          if (!company && companyDomain) {
            // Try to find by domain
            company = existingCompanies.find(
              (c) => c.domain && c.domain.toLowerCase().trim() === companyDomain.toLowerCase()
            );
          }

          if (company) {
            companyId = company.id;
            results.companiesFound++;
          } else {
            // Create new company
            if (companyDomain) {
              company = await findOrCreateCompanyByDomain(
                companyDomain,
                companyHQId,
                companyName || 'Unknown Company'
              );
              if (company && !existingCompanies.find((c) => c.id === company.id)) {
                existingCompanies.push(company);
                companyMap.set(companyName?.toLowerCase().trim(), company);
                companyMap.set(companyDomain.toLowerCase().trim(), company);
              }
            } else if (companyName) {
              company = await prisma.companies.create({
                data: {
                  companyHQId,
                  companyName: companyName,
                },
              });
              existingCompanies.push(company);
              companyMap.set(companyName.toLowerCase().trim(), company);
            }

            if (company) {
              companyId = company.id;
              results.companiesCreated++;
            }
          }

          // Associate company to contact
          if (companyId) {
            await prisma.contact.update({
              where: { id: contact.id },
              data: {
                companyId,
                contactCompanyId: companyId, // Legacy field
              },
            });
          }
        }

        // Step 3: Set pipeline
        if (normalizedRow.pipeline || normalizedRow.stage) {
          await ensureContactPipeline(contact.id, {
            pipeline: normalizedRow.pipeline || 'prospect',
            stage: normalizedRow.stage || 'interest',
          });
        } else {
          // Ensure default pipeline exists
          await ensureContactPipeline(contact.id, {
            pipeline: 'prospect',
            stage: 'interest',
          });
        }
      } catch (error) {
        results.errors.push(`Row ${rowNum}: ${error.message || 'Failed to process contact'}`);
        console.error(`Error processing row ${rowNum}:`, error);
      }
    }

    // Refresh contacts cache would be done client-side after success

    return NextResponse.json({
      success: true,
      ...results,
      total: parsed.rows.length,
      message: `Processed ${parsed.rows.length} rows: ${results.created} created, ${results.updated} updated`,
    });
  } catch (error) {
    console.error('❌ BatchContacts error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process batch contacts',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

