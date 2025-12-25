/**
 * Global Server Error Handler
 * 
 * Centralized error handling for server-side code (API routes, server components).
 * Ensures all errors are:
 * 1. Logged to Vercel logs (console.error)
 * 2. Captured by Sentry
 * 3. Re-thrown to propagate properly
 * 
 * Usage:
 *   try {
 *     // your code
 *   } catch (error) {
 *     throw handleServerError(error, { route: '/api/example' });
 *   }
 */

import * as Sentry from '@sentry/nextjs';

interface ErrorContext {
  route?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Handle a server-side error:
 * - Logs to console (appears in Vercel logs)
 * - Captures in Sentry with context
 * - Returns the normalized error (caller decides whether to re-throw or return HTTP response)
 * 
 * For API routes: Log/capture then return NextResponse.json
 * For server components: Log/capture then re-throw
 * 
 * @param error - The error to handle (unknown type for safety)
 * @param context - Optional context for better debugging
 * @returns The normalized error (caller handles response)
 */
export function handleServerError(
  error: unknown,
  context?: ErrorContext
): Error {
  // Normalize error to Error object
  const normalizedError = error instanceof Error 
    ? error 
    : new Error(String(error));

  // Extract error details
  const errorMessage = normalizedError.message || 'Unknown error';
  const errorStack = normalizedError.stack;
  const errorName = normalizedError.name || 'Error';

  // Log to console (appears in Vercel logs)
  console.error('❌ Server Error:', {
    message: errorMessage,
    name: errorName,
    stack: errorStack,
    ...context,
  });

  // Capture in Sentry with context
  Sentry.captureException(normalizedError, {
    tags: {
      component: 'server',
      ...(context?.route && { route: context.route }),
    },
    extra: {
      ...context,
      errorName,
      errorMessage,
    },
    level: 'error',
  });

  // Return normalized error (caller decides next step)
  return normalizedError;
}

/**
 * Determine HTTP status code from error
 */
export function getErrorStatusCode(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  
  if (message?.includes('Unauthorized') || message?.includes('authentication')) {
    return 401;
  }
  if (message?.includes('Forbidden') || message?.includes('permission')) {
    return 403;
  }
  if (message?.includes('Not Found')) {
    return 404;
  }
  if (message?.includes('credits') || message?.includes('exceeded')) {
    return 402; // Payment Required
  }
  
  return 500;
}

/**
 * Wrap an async function to automatically handle errors
 * 
 * Usage:
 *   export const GET = wrapApiHandler(async (request) => {
 *     // your handler code
 *   });
 */
export function wrapApiHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  context?: Omit<ErrorContext, 'route'>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      // Extract route from request if available
      const request = args[0];
      const route = request?.url 
        ? new URL(request.url).pathname 
        : context?.route || 'unknown';

      throw handleServerError(error, {
        ...context,
        route,
      });
    }
  }) as T;
}

