'use client';

import { useEffect } from 'react';

/**
 * Global Error Boundary for App Router
 * 
 * Catches errors in client components and React render errors.
 * This is the App Router equivalent of a React Error Boundary.
 * 
 * Note: This does NOT catch:
 * - Server component errors (handled by global-error.tsx)
 * - API route errors (handled by handleServerError)
 * - Errors in error.tsx itself (handled by global-error.tsx)
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (appears in browser console)
    console.error('❌ Client Error:', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
        <p className="text-gray-600">
          We encountered an unexpected error. Our team has been notified.
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
  );
}

