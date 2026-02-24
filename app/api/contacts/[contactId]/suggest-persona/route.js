import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { PersonaSuggestionService } from '@/lib/services/PersonaSuggestionService';

/**
 * POST /api/contacts/[contactId]/suggest-persona
 * Analyze contact notes and suggest an outreach persona
 * Body: { note?: string } (optional - uses existing notes if not provided)
 */
export async function POST(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Await params in Next.js 15+ App Router
    const resolvedParams = await params;
    const { contactId } = resolvedParams || {};
    
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { note } = body;

    const result = await PersonaSuggestionService.suggestPersona(contactId, note);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      relationshipContext: result.relationshipContext,
      suggestedPersonaSlug: result.suggestedPersonaSlug,
      confidence: result.confidence,
      reasoning: result.reasoning,
    });
  } catch (error) {
    console.error('Error in suggest-persona endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to suggest persona',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
