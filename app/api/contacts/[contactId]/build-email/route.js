import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { OutreachEmailBuilderService } from '@/lib/services/OutreachEmailBuilderService';

/**
 * POST /api/contacts/[contactId]/build-email
 * Build an AI-generated outreach email for a contact
 * Body: { personaSlug?, relationshipContext?, companyHQId? }
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
    const { personaSlug, relationshipContext, companyHQId } = body;

    const result = await OutreachEmailBuilderService.buildEmail({
      contactId,
      personaSlug: personaSlug || null,
      relationshipContext: relationshipContext || undefined,
      companyHQId: companyHQId || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      emailType: result.emailType,
      subject: result.subject,
      body: result.body,
      reasoning: result.reasoning,
    });
  } catch (error) {
    console.error('Error in build-email endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to build email',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
