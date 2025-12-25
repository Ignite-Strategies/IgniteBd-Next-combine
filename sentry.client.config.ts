/**
 * Sentry Client Configuration
 * 
 * This file is ONLY executed in the browser (client-side).
 * It is imported by app/SentryInit.jsx which is a client component.
 * 
 * IMPORTANT: This config should NEVER be imported in:
 * - Server components
 * - API routes
 * - Server-side code
 * 
 * For server-side Sentry, use: import * as Sentry from '@sentry/nextjs' directly
 * (Server config is handled by instrumentation.ts → sentry.server.config.ts)
 */

import * as Sentry from '@sentry/nextjs';

// Only initialize Sentry in browser environment
// This prevents SSR/prerendering errors with replayIntegration
if (typeof window !== 'undefined') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1.0,
    
    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
    
    replaysOnErrorSampleRate: 1.0,
    
    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0.1,
    
    // Session Replay integration (client-only feature)
    integrations: [
      Sentry.replayIntegration({
        // Additional Replay configuration goes in here, for example:
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    environment: process.env.NODE_ENV,
    
    // Add tags for better filtering
    initialScope: {
      tags: {
        component: 'client',
      },
    },
  });
}

