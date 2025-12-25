/**
 * Next.js Instrumentation Hook
 * 
 * This file is automatically executed by Next.js at startup.
 * It initializes Sentry for server-side and edge runtimes.
 * 
 * Runtime Separation:
 * - Node.js runtime → loads sentry.server.config.ts
 * - Edge runtime → loads sentry.edge.config.ts
 * - Client runtime → NOT handled here (handled by SentryInit.jsx → sentry.client.config.ts)
 * 
 * IMPORTANT: This file should NEVER import sentry.client.config.ts
 * Client-side Sentry is initialized separately via app/SentryInit.jsx
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

