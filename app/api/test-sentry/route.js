import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

/**
 * Test route to verify Sentry is working
 * GET /api/test-sentry?error=true to trigger a test error
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shouldError = searchParams.get('error') === 'true';

  if (shouldError) {
    // Test error capture
    try {
      throw new Error('Sentry test error - this is intentional');
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          route: '/api/test-sentry',
          test: true,
        },
        extra: {
          message: 'This is a test error to verify Sentry is working',
          timestamp: new Date().toISOString(),
        },
      });
      
      return NextResponse.json(
        {
          success: false,
          message: 'Test error sent to Sentry! Check your Sentry dashboard.',
          error: error.message,
        },
        { status: 500 }
      );
    }
  }

  // Return Sentry status
  return NextResponse.json({
    success: true,
    message: 'Sentry is configured',
    sentry: {
      dsn: process.env.SENTRY_DSN ? 'Configured' : 'Not configured',
      org: process.env.SENTRY_ORG || 'Not set',
      project: process.env.SENTRY_PROJECT || 'Not set',
    },
    instructions: 'Add ?error=true to the URL to test error tracking',
  });
}

