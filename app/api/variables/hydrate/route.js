import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { 
  hydrateTemplateFromDatabase,
} from '@/lib/services/variableMapperService';

/**
 * POST /api/variables/hydrate
 * 
 * UNIVERSAL variable hydration endpoint - works on ANY content, not just templates.
 * 
 * This is the top-level variable resolution service. It doesn't care if the content
 * came from a template or was manually typed - it just resolves variables in the content.
 * 
 * The body field (or any content) is the single source of truth. Variables get resolved
 * from the database based on contactId/email, regardless of content source.
 * 
 * Request body:
 * {
 *   "content": "Hi {{firstName}}, welcome to {{companyName}}", // ANY content with variables
 *   "contactId": "uuid", // Optional - will infer from 'to' field if missing
 *   "to": "email@example.com", // Optional - used to infer contact if contactId missing
 *   "metadata": {} // Optional metadata for computed variables
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "hydratedContent": "Hi John, welcome to Acme Corp",
 *   "variables": ["firstName", "companyName"], // Variables found in content
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
      content, // The content to hydrate (subject, body, or any string)
      contactId, 
      to, // Optional: recipient email field - used as fallback if contactId is invalid
      metadata = {} 
    } = body ?? {};

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 },
      );
    }

    // Build context for variable resolution
    // Variable mapper service will query database based on contactId or infer from 'to' field
    const context = {
      contactId: contactId || undefined,
      contactEmail: undefined, // Will be inferred from 'to' if contactId is missing/invalid
      to: to || undefined, // Pass 'to' field so variable mapper can extract email if needed
      metadata,
    };

    // Hydrate content using variable mapper service
    // This is the universal hydration - works on ANY content, not just templates
    const hydratedContent = await hydrateTemplateFromDatabase(
      content,
      context,
      metadata
    );

    return NextResponse.json({
      success: true,
      hydratedContent,
      originalContent: content,
      contactId: contactId || null,
      metadata,
    });
  } catch (error) {
    console.error('❌ Variable hydration error:', error);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Failed to hydrate variables',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

