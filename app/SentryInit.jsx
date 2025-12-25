'use client';

/**
 * Sentry Client Initialization Component
 * 
 * This component ensures Sentry client config is loaded ONLY in the browser.
 * It wraps the app in app/layout.js to initialize client-side Sentry.
 * 
 * IMPORTANT:
 * - This is a CLIENT component ('use client')
 * - It imports sentry.client.config.ts which is browser-only
 * - This should NEVER be used in server components or API routes
 * 
 * Server-side Sentry is initialized separately via instrumentation.ts
 */

import '../sentry.client.config';

export default function SentryInit({ children }) {
  return <>{children}</>;
}

