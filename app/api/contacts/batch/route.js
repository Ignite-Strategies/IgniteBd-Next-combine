import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';
import { parseCSV } from '@/lib/utils/csv';
import { ensureContactPipeline } from '@/lib/services/pipelineService';
import { OFFICIAL_PIPELINES, PIPELINE_STAGES } from '@/lib/config/pipelineConfig';

/**
 * POST /api/contacts/batch
 * Batch create contacts with company association and pipeline setup
 * Simple contact save process - matches the simplified contact creation flow
 * 
 * Body: FormData with 'file' field containing CSV
 * CSV format (LinkedIn-style columns supported):
 * - firstName, lastName (required)
 * - email / email address (optional but recommended for outreach)
 * - company / company name (optional - for company association)
 * - title / position (optional - job title)
 * - url (optional - LinkedIn profile URL)
 * - connected on (optional - LinkedIn connection date, for context)
 * - phone (optional)
 * - notes (optional)
 * - pipeline, stage (optional - for deal stage/pipeline setup)
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
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
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

    // Get owner from firebaseId
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true }
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // Membership guard
    const { membership } = await resolveMembership(owner.id, companyHQId);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No membership in this CompanyHQ' },
        { status: 403 },
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

    // Normalize headers (case-insensitive matching) - simplified to match simple contact save process
    const normalizeHeader = (header) => {
      const normalized = header.toLowerCase().trim();
      const mappings = {
        'first name': 'firstName',
        'firstname': 'firstName',
        'first': 'firstName',
        'last name': 'lastName',
        'lastname': 'lastName',
        'last': 'lastName',
        'email': 'email',
        'email address': 'email',
        'company name': 'companyName',
        'companyname': 'companyName',
        'company': 'companyName',
        'title': 'title',
        'job title': 'title',
        'jobtitle': 'title',
        'position': 'title',
        'url': 'linkedinUrl',
        'linkedin': 'linkedinUrl',
        'linkedin url': 'linkedinUrl',
        'linkedinurl': 'linkedinUrl',
        'profile url': 'linkedinUrl',
        'connected on': 'linkedinConnectedOn',
        'connectedon': 'linkedinConnectedOn',
        'phone': 'phone',
        'phone number': 'phone',
        'phonenumber': 'phone',
        'mobile': 'phone',
        'notes': 'notes',
        'note': 'notes',
        'pipeline': 'pipeline',
        'stage': 'stage',
      };
      return mappings[normalized] || normalized;
    };

    // Normalize pipeline/stage values from CSV (human-friendly or close → canonical slugs)
    const normalizePipelineValue = (raw) => {
      if (!raw || typeof raw !== 'string') return null;
      const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
      const map = {
        prospect: 'prospect',
        prospects: 'prospect',
        client: 'client',
        clients: 'client',
        collaborator: 'collaborator',
        collaborators: 'collaborator',
        institution: 'institution',
        institutions: 'institution',
        unassigned: 'unassigned',
        none: 'unassigned',
      };
      return map[s] || (OFFICIAL_PIPELINES.includes(s) ? s : null);
    };

    const normalizeStageValue = (raw, pipeline = 'prospect') => {
      if (!raw || typeof raw !== 'string') return null;
      const s = raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s/g, '-');
      const stages = PIPELINE_STAGES[pipeline] || PIPELINE_STAGES.prospect;
      // Prospect: map human-friendly / close variants to canonical
      const prospectMap = {
        'need-to-engage': 'need-to-engage',
        'awaiting-outreach': 'need-to-engage',
        'not-contacted': 'need-to-engage',
        'to-contact': 'need-to-engage',
        interest: 'interest',
        interested: 'interest',
        meeting: 'meeting',
        proposal: 'proposal',
        contract: 'contract',
        'contract-signed': 'contract-signed',
        signed: 'contract-signed',
      };
      const canonical = (pipeline === 'prospect' && prospectMap[s]) || (stages.includes(s) ? s : null);
      return canonical;
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

        // Extract contact data (name, email, title, phone, notes, company, pipeline/stage)
        const contactData = {
          firstName: normalizedRow.firstName,
          lastName: normalizedRow.lastName,
          email: normalizedRow.email ? normalizedRow.email.toLowerCase().trim() : null,
          title: normalizedRow.title || null,
          phone: normalizedRow.phone || null,
          notes: normalizedRow.notes || null,
          linkedinUrl: normalizedRow.linkedinUrl || null,
          linkedinConnectedOn: normalizedRow.linkedinConnectedOn || null,
        };

        // Step 1: Create or update contact
        let contact;
        if (contactData.email) {
          // Email is globally unique, so use findUnique
          const normalizedEmail = contactData.email.toLowerCase().trim();
          let existingContact = null;
          
          try {
            existingContact = await prisma.contact.findUnique({
              where: {
                email: normalizedEmail,
              },
            });
          } catch (error) {
            // findUnique throws P2025 if not found, which is fine
            if (error.code !== 'P2025') {
              throw error;
            }
          }

          if (existingContact) {
            // Verify it's in the same tenant
            if (existingContact.crmId !== companyHQId) {
              // Email exists in different tenant - this shouldn't happen but handle gracefully
              console.warn(`⚠️ Email ${normalizedEmail} exists in different tenant (${existingContact.crmId} vs ${companyHQId})`);
              // Can't create with same email - skip this row
              results.errors.push(`Row ${rowNum}: Email ${normalizedEmail} already exists in another tenant`);
              continue;
            }
            
            // Update existing contact (name, email, title, phone, notes)
            const updateData = {
              firstName: contactData.firstName,
              lastName: contactData.lastName,
            };
            if (contactData.title !== undefined) updateData.title = contactData.title;
            if (contactData.phone !== undefined) updateData.phone = contactData.phone;
            if (contactData.notes !== undefined) updateData.notes = contactData.notes;
            if (contactData.linkedinUrl !== undefined) updateData.linkedinUrl = contactData.linkedinUrl;
            if (contactData.linkedinConnectedOn !== undefined) updateData.linkedinConnectedOn = contactData.linkedinConnectedOn;
            contact = await prisma.contact.update({
              where: { id: existingContact.id },
              data: updateData,
            });
            results.updated++;
          } else {
            // Create new contact - email is unique so this should work
            try {
              const createData = {
                crmId: companyHQId,
                firstName: contactData.firstName,
                lastName: contactData.lastName,
                email: normalizedEmail,
                title: contactData.title,
                phone: contactData.phone,
                notes: contactData.notes,
                linkedinUrl: contactData.linkedinUrl,
                linkedinConnectedOn: contactData.linkedinConnectedOn,
              };
              contact = await prisma.contact.create({
                data: createData,
              });
              results.created++;
            } catch (createError) {
              // Handle unique constraint violation (race condition)
              if (createError.code === 'P2002' && createError.meta?.target?.includes('email')) {
                // Email was created between our check and create - try to find it
                try {
                  const raceContact = await prisma.contact.findUnique({
                    where: { email: normalizedEmail },
                  });
                  if (raceContact && raceContact.crmId === companyHQId) {
                    // Found it, update instead - only update name (simple fields)
                    const raceUpdateData = {
                      firstName: contactData.firstName,
                      lastName: contactData.lastName,
                    };
                    if (contactData.title !== undefined) raceUpdateData.title = contactData.title;
                    if (contactData.phone !== undefined) raceUpdateData.phone = contactData.phone;
                    if (contactData.notes !== undefined) raceUpdateData.notes = contactData.notes;
                    if (contactData.linkedinUrl !== undefined) raceUpdateData.linkedinUrl = contactData.linkedinUrl;
                    if (contactData.linkedinConnectedOn !== undefined) raceUpdateData.linkedinConnectedOn = contactData.linkedinConnectedOn;
                    contact = await prisma.contact.update({
                      where: { id: raceContact.id },
                      data: raceUpdateData,
                    });
                    results.updated++;
                  } else {
                    throw createError; // Re-throw if tenant mismatch
                  }
                } catch (findError) {
                  throw createError; // Re-throw original error
                }
              } else {
                throw createError;
              }
            }
          }
        } else {
          // Create contact without email - check for duplicate by name in same company
          // (Company-scoped: same person added twice = update existing to avoid duplicates)
          const existingByName = await prisma.contact.findFirst({
            where: {
              crmId: companyHQId,
              firstName: contactData.firstName,
              lastName: contactData.lastName,
              email: null,
            },
            select: { id: true },
          });

          if (existingByName) {
            const updateData = {};
            if (contactData.title !== undefined) updateData.title = contactData.title;
            if (contactData.phone !== undefined) updateData.phone = contactData.phone;
            if (contactData.notes !== undefined) updateData.notes = contactData.notes;
            if (contactData.linkedinUrl !== undefined) updateData.linkedinUrl = contactData.linkedinUrl;
            if (contactData.linkedinConnectedOn !== undefined) updateData.linkedinConnectedOn = contactData.linkedinConnectedOn;
            contact = await prisma.contact.update({
              where: { id: existingByName.id },
              data: updateData,
            });
            results.updated++;
          } else {
            contact = await prisma.contact.create({
              data: {
                crmId: companyHQId,
                firstName: contactData.firstName,
                lastName: contactData.lastName,
                title: contactData.title,
                phone: contactData.phone,
                notes: contactData.notes,
                linkedinUrl: contactData.linkedinUrl,
                linkedinConnectedOn: contactData.linkedinConnectedOn,
              },
            });
            results.created++;
          }
        }

        // Step 2: Handle company association (simple - companyName only)
        let companyId = null;
        if (normalizedRow.companyName) {
          const companyName = normalizedRow.companyName?.trim();

          // Try to find existing company by name
          let company = null;
          if (companyName) {
            const normalizedName = companyName.toLowerCase().trim();
            company = existingCompanies.find(
              (c) => c.companyName && c.companyName.toLowerCase().trim() === normalizedName
            );
          }

          if (company) {
            companyId = company.id;
            results.companiesFound++;
          } else if (companyName) {
            // Create new company
            company = await prisma.companies.create({
              data: {
                companyHQId,
                companyName: companyName,
              },
            });
            existingCompanies.push(company);
            companyMap.set(companyName.toLowerCase().trim(), company);
            companyId = company.id;
            results.companiesCreated++;
          }

          // Associate company to contact (ONLY set contactCompanyId - the FK)
          if (companyId) {
            await prisma.contact.update({
              where: { id: contact.id },
              data: {
                contactCompanyId: companyId, // Only set the FK, not companyId (enrichment field)
              },
            });
          }
        }

        // Step 3: Set pipeline (default: prospect / need-to-engage = "awaiting outreach")
        const rawPipeline = normalizedRow.pipeline || '';
        const rawStage = normalizedRow.stage || '';
        const pipeline = normalizePipelineValue(rawPipeline) || 'prospect';
        const stageForPipeline = pipeline === 'unassigned'
          ? null
          : (normalizeStageValue(rawStage, pipeline) || (pipeline === 'prospect' ? 'need-to-engage' : (PIPELINE_STAGES[pipeline]?.[0] || 'interest')));
        await ensureContactPipeline(contact.id, {
          pipeline,
          stage: stageForPipeline,
          defaultPipeline: 'prospect',
          defaultStage: 'need-to-engage',
        });
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

