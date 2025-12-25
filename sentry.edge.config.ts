/**
 * Sentry Edge Configuration
 * 
 * This file is ONLY executed in Edge runtime (middleware, edge API routes).
 * It is automatically loaded by instrumentation.ts when NEXT_RUNTIME === 'edge'.
 * 
 * IMPORTANT: This config should NEVER be imported in:
 * - Client components
 * - Node.js server runtime
 * - Browser code
 * 
 * For client-side Sentry, use: sentry.client.config.ts (via SentryInit.jsx)
 * For server-side Sentry, use: sentry.server.config.ts (via instrumentation.ts)
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  
  environment: process.env.NODE_ENV,
  
  // Add tags for better filtering
  initialScope: {
    tags: {
      component: 'edge',
    },
  },
  
  // Edge runtime does NOT include replayIntegration (client-only feature)
  // Do NOT add replayIntegration here - it will cause errors
});

