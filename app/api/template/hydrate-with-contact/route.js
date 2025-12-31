import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { 
  hydrateTemplateFromDatabase,
  extractVariableNames,
  validateHydration,
} from '@/lib/services/variableMapperService';

/**
 * POST /api/template/hydrate-with-contact
 * 
 * API endpoint wrapper for template hydration.
 * 
 * This is NOT a separate service - it's a thin API wrapper that:
 * 1. Fetches the template from database
 * 2. Delegates to variableMapperService (the universal variable resolution service)
 * 3. Returns hydrated template with validation
 * 
 * The actual variable resolution logic is in: lib/services/variableMapperService.js
 * 
 * Request body:
 * {
 *   "templateId": "uuid",
 *   "contactId": "uuid", // Optional - variable mapper will infer from 'to' field if missing
 *   "to": "email@example.com", // Optional - used as fallback if contactId is invalid
 *   "metadata": {} // Optional metadata for computed variables (timeHorizon, etc.)
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "hydratedSubject": "Hi John, ...",
 *   "hydratedBody": "Hey John,\n\n...",
 *   "originalTemplate": { "subject": "...", "body": "..." },
 *   "validation": { "valid": true, "missingVariables": [] },
 *   "variables": ["firstName", "companyName"], // Variables found in template
 * }
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { 
      templateId, 
      contactId, 
      to, // Optional: recipient email field (can be "Name <email>" or just "email") - used as fallback if contactId is invalid
      metadata = {} // Additional context like desiredOutcome, timeHorizon, etc.
    } = body ?? {};

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 },
      );
    }

    // Fetch the template (using new Template model)
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        title: true,
        subject: true,
        body: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 },
      );
    }

    // Build context for variable resolution
    // Note: If contactId is invalid, variable mapper will try to infer from 'to' field if provided
    const context = {
      contactId: contactId || undefined,
      contactEmail: undefined, // Will be inferred from 'to' if contactId is missing/invalid
      to: to || undefined, // Pass 'to' field so variable mapper can extract email if needed
      metadata,
    };

    // Extract variables from both subject and body
    const subjectVariables = extractVariableNames(template.subject);
    const bodyVariables = extractVariableNames(template.body);
    const allVariables = Array.from(new Set([...subjectVariables, ...bodyVariables]));

    // Hydrate subject and body using variable mapper service
    // This queries the database based on contactId and maps to variables
    const hydratedSubject = await hydrateTemplateFromDatabase(
      template.subject,
      context,
      metadata
    );

    const hydratedBody = await hydrateTemplateFromDatabase(
      template.body,
      context,
      metadata
    );

    // Validate hydration (check for any unresolved variables)
    const subjectValidation = validateHydration(hydratedSubject);
    const bodyValidation = validateHydration(hydratedBody);
    const allValid = subjectValidation.valid && bodyValidation.valid;
    const missingVariables = [
      ...subjectValidation.missingVariables,
      ...bodyValidation.missingVariables,
    ];

    return NextResponse.json({
      success: true,
      hydratedSubject,
      hydratedBody,
      originalTemplate: {
        subject: template.subject,
        body: template.body,
        title: template.title,
      },
      validation: {
        valid: allValid,
        missingVariables: Array.from(new Set(missingVariables)),
      },
      variables: allVariables, // List of variables found in template
      contactId: contactId || null,
      metadata,
    });
  } catch (error) {
    console.error('❌ Template hydrate with contact error:', error);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Failed to hydrate template with contact data',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
