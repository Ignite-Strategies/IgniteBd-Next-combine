'use client';

// Initialize Sentry on client side
import '../sentry.client.config';

export default function SentryInit({ children }) {
  return <>{children}</>;
}

