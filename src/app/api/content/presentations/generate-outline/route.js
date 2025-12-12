import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { generatePresentationOutline } from '@/lib/services/PresentationGenerationService';

/**
 * POST /api/content/presentations/generate-outline
 * Generate a presentation outline using AI
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
    const body = await request.json();
    const { presentationIdea, slideCount = 10 } = body ?? {};

    if (!presentationIdea || !presentationIdea.trim()) {
      return NextResponse.json(
        { success: false, error: 'Presentation idea is required' },
        { status: 400 },
      );
    }

    const slideNum = parseInt(slideCount, 10);
    if (isNaN(slideNum) || slideNum < 1 || slideNum > 100) {
      return NextResponse.json(
        { success: false, error: 'Slide count must be between 1 and 100' },
        { status: 400 },
      );
    }

    console.log(`🎯 Generating presentation outline: ${slideNum} slides`);

    const result = await generatePresentationOutline(
      presentationIdea.trim(),
      slideNum
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to generate presentation outline',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      outline: result.presentation,
    });
  } catch (error) {
    console.error('❌ GenerateOutline error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate presentation outline',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
