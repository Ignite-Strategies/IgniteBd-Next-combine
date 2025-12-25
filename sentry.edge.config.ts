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
});

