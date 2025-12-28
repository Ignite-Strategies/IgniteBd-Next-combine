'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Global Error Boundary for Root Layout
 * 
 * Catches errors that occur in:
 * - Root layout
 * - Error boundaries themselves (error.tsx)
 * - Server component errors that bubble up
 * 
 * This is the last line of defense for React errors.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console
    console.error('❌ Global Error:', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });

    // Capture in Sentry
    Sentry.captureException(error, {
      tags: {
        component: 'global',
        errorBoundary: 'global-error.tsx',
      },
      extra: {
        digest: error.digest,
      },
      level: 'fatal', // Global errors are more severe
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-8">
          <div className="max-w-md w-full space-y-4 text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Application Error
            </h2>
            <p className="text-gray-600">
              A critical error occurred. Please refresh the page or contact support.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">
                  Error details (development only)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-4 rounded overflow-auto">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </details>
            )}
            <div className="flex gap-4 justify-center mt-6">
              <button
                onClick={reset}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Try again
              </button>
              <button
                onClick={() => (window.location.href = '/growth-dashboard')}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

