/**
 * Sentry Server Configuration
 * 
 * This file is ONLY executed in Node.js server runtime (API routes, server components).
 * It is automatically loaded by instrumentation.ts when NEXT_RUNTIME === 'nodejs'.
 * 
 * IMPORTANT: This config should NEVER be imported in:
 * - Client components
 * - Browser code
 * - Client-side code
 * 
 * For client-side Sentry, use: sentry.client.config.ts (via SentryInit.jsx)
 * For edge runtime Sentry, use: sentry.edge.config.ts (via instrumentation.ts)
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  
  environment: process.env.NODE_ENV,
  
  // Add tags for better filtering
  initialScope: {
    tags: {
      component: 'server',
    },
  },
  
  // Server-side does NOT include replayIntegration (client-only feature)
  // Do NOT add replayIntegration here - it will cause errors
});

