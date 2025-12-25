/**
 * Next.js Instrumentation Hook
 * 
 * This file is automatically executed by Next.js at startup.
 * It initializes Sentry for server-side and edge runtimes.
 * 
 * Runtime Separation:
 * - Node.js runtime → loads sentry.server.config.ts
 * - Edge runtime → loads sentry.edge.config.ts
 * - Client runtime → NOT handled here (handled by providers.jsx → sentry.client.config.ts)
 * 
 * IMPORTANT: This file should NEVER import sentry.client.config.ts
 * Client-side Sentry is initialized separately via app/providers.jsx
 * 
 * Build Optimization: Skip Sentry initialization during build phase to speed up builds
 */

export async function register() {
  // Skip Sentry initialization during build to speed up builds (saves 2-4 minutes)
  // Sentry will still work at runtime, just not during the build process
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.SKIP_SENTRY_BUILD === 'true'
  ) {
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

