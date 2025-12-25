# Sentry Error Tracking Setup

## Overview

Sentry has been configured for comprehensive error tracking across the entire Next.js application. This setup captures errors from client-side (browser), server-side (API routes), and edge runtime environments.

## Architecture

### Three-Tier Error Tracking

1. **Client-Side** (`sentry.client.config.ts`)
   - Captures React component errors
   - Browser JavaScript errors
   - Unhandled promise rejections
   - Session Replay for debugging

2. **Server-Side** (`sentry.server.config.ts`)
   - API route errors (`/app/api/*`)
   - Server component errors
   - Unhandled promise rejections
   - Database query errors

3. **Edge Runtime** (`sentry.edge.config.ts`)
   - Edge function errors
   - Middleware errors
   - Edge API routes

### Initialization Flow

```
App Startup
├── instrumentation.ts (runs first)
│   ├── Server Runtime → loads sentry.server.config.ts
│   └── Edge Runtime → loads sentry.edge.config.ts
│
└── app/layout.js
    └── SentryInit.jsx (client component)
        └── loads sentry.client.config.ts
```

## Files Created

### Core Configuration Files

1. **`instrumentation.ts`** (root)
   - Entry point for server-side Sentry initialization
   - Automatically loaded by Next.js
   - Routes to appropriate config based on runtime

2. **`sentry.client.config.ts`** (root)
   - Client-side Sentry configuration
   - Initialized via `app/SentryInit.jsx`
   - Includes Session Replay for debugging

3. **`sentry.server.config.ts`** (root)
   - Server-side Sentry configuration
   - Captures API route errors
   - Includes unhandled rejection tracking

4. **`sentry.edge.config.ts`** (root)
   - Edge runtime Sentry configuration
   - For Vercel Edge Functions

5. **`app/SentryInit.jsx`**
   - Client-side wrapper component
   - Ensures Sentry initializes only on client
   - Wraps the entire app in `app/layout.js`

6. **`.sentryclirc`**
   - Sentry CLI configuration
   - Used for source map uploads
   - Contains org and project info

### Modified Files

1. **`next.config.mjs`**
   - Wrapped with `withSentryConfig()`
   - Configures source map uploads
   - Sets up Sentry webpack plugin
   - Configures tunnel route for ad-blocker bypass

2. **`app/layout.js`**
   - Added `SentryInit` wrapper
   - Ensures client-side initialization

3. **`package.json`**
   - Added `@sentry/nextjs` dependency

## Configuration Details

### Client Configuration (`sentry.client.config.ts`)

```typescript
- DSN: NEXT_PUBLIC_SENTRY_DSN (public env var)
- Traces Sample Rate: 100% (all requests traced)
- Session Replay: Enabled
  - Replay on Error: 100%
  - Replay Session: 10%
- Debug Mode: Disabled (set to true for troubleshooting)
- Environment: NODE_ENV
```

**Features:**
- Session Replay captures user interactions leading to errors
- Text masking enabled for privacy
- Media blocking enabled for privacy

### Server Configuration (`sentry.server.config.ts`)

```typescript
- DSN: SENTRY_DSN (private env var)
- Traces Sample Rate: 100%
- Unhandled Rejections: Captured
- Environment: NODE_ENV
```

**Features:**
- Captures all API route errors
- Tracks unhandled promise rejections
- Server-side error context

### Edge Configuration (`sentry.edge.config.ts`)

```typescript
- DSN: SENTRY_DSN (private env var)
- Traces Sample Rate: 100%
- Environment: NODE_ENV
```

## Environment Variables

### Required for Production

Add these to **Vercel Environment Variables** (or `.env.local` for local):

```bash
# Sentry DSN (get from Sentry dashboard)
SENTRY_DSN=https://your-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id

# Optional: For source map uploads (recommended)
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=ignite-strategies
SENTRY_PROJECT=ignitebd-logge
```

### Getting Your DSN

1. Go to: https://sentry.io/organizations/ignite-strategies/projects/ignitebd-logge/
2. Navigate to: **Settings → Client Keys (DSN)**
3. Copy the DSN (looks like: `https://abc123@o123456.ingest.sentry.io/123456`)
4. Add to environment variables

### Getting Auth Token (for source maps)

1. Go to: https://sentry.io/settings/account/api/auth-tokens/
2. Click **Create New Token**
3. Select scopes:
   - `project:read`
   - `project:releases`
   - `org:read`
4. Copy token and add as `SENTRY_AUTH_TOKEN`

## How It Works

### Error Capture Flow

```
Error Occurs
    │
    ├─ Client Error (React/Browser)
    │   └─→ sentry.client.config.ts
    │       └─→ Sentry Dashboard
    │
    ├─ Server Error (API Route)
    │   └─→ sentry.server.config.ts
    │       └─→ Sentry Dashboard
    │
    └─ Edge Error (Middleware/Edge Route)
        └─→ sentry.edge.config.ts
            └─→ Sentry Dashboard
```

### Automatic Error Tracking

Sentry automatically captures:

- ✅ Unhandled exceptions
- ✅ Unhandled promise rejections
- ✅ React component errors (Error Boundaries)
- ✅ API route errors
- ✅ Server component errors
- ✅ Edge function errors
- ✅ Network request failures
- ✅ Console errors (client-side)

### Manual Error Reporting

You can also manually report errors:

```javascript
// In API routes
import * as Sentry from '@sentry/nextjs';

try {
  // your code
} catch (error) {
  Sentry.captureException(error);
  throw error;
}

// With context
Sentry.captureException(error, {
  tags: { route: '/api/outreach/send' },
  extra: { userId: user.id },
});
```

## Verification

### Test Error Tracking

1. **Create a test error** (temporary):

```javascript
// In any API route (e.g., app/api/test-sentry/route.js)
export async function GET() {
  throw new Error('Sentry test error');
}
```

2. **Trigger the error**:
   - Visit: `http://localhost:3000/api/test-sentry`
   - Or deploy and visit production URL

3. **Check Sentry Dashboard**:
   - Go to: https://sentry.io/organizations/ignite-strategies/projects/ignitebd-logge/
   - Navigate to **Issues**
   - You should see the test error within seconds

### Verify Configuration

```bash
# Check if Sentry package is installed
npm list @sentry/nextjs

# Check environment variables (local)
cat .env.local | grep SENTRY

# Build should include Sentry
npm run build
```

## Source Maps

Source maps are automatically uploaded during build if `SENTRY_AUTH_TOKEN` is set.

**Benefits:**
- See original source code in error stack traces
- Better debugging experience
- Exact line numbers in production

**Configuration:**
- Source maps are hidden from client bundles (`hideSourceMaps: true`)
- Automatically uploaded to Sentry during `npm run build`
- Only accessible via Sentry dashboard

## Performance Monitoring

Sentry tracks:

- **Transaction Performance**
  - API route response times
  - Page load times
  - Component render times

- **Traces**
  - Request traces (100% sample rate)
  - Database query performance
  - External API call performance

## Session Replay

**Enabled for client-side errors only**

- Records user interactions before errors
- Helps reproduce bugs
- Privacy-focused (text masked, media blocked)

**Sample Rates:**
- On Error: 100% (always record when error occurs)
- Session: 10% (random sampling)

## Troubleshooting

### Errors Not Appearing in Sentry

1. **Check DSN is set**:
   ```bash
   echo $SENTRY_DSN
   echo $NEXT_PUBLIC_SENTRY_DSN
   ```

2. **Check Sentry initialization**:
   - Look for Sentry logs in browser console (if debug enabled)
   - Check network tab for Sentry API calls

3. **Verify environment variables**:
   - Ensure variables are set in Vercel
   - Redeploy after adding variables

4. **Check Sentry dashboard**:
   - Verify project is active
   - Check for rate limiting
   - Verify DSN matches

### Build Errors

If build fails with Sentry errors:

1. **Check `SENTRY_AUTH_TOKEN`** (optional, only needed for source maps)
2. **Disable source maps temporarily**:
   ```javascript
   // In next.config.mjs, comment out withSentryConfig wrapper
   ```

3. **Check Sentry org/project names**:
   - Verify `.sentryclirc` matches your Sentry setup

### Client-Side Not Working

1. **Check `NEXT_PUBLIC_SENTRY_DSN`** is set (must be public)
2. **Verify `SentryInit` component** is in layout
3. **Check browser console** for Sentry initialization errors
4. **Verify client config** is being imported

## Best Practices

### Error Context

Always add context when capturing errors:

```javascript
Sentry.captureException(error, {
  tags: {
    route: '/api/outreach/send',
    component: 'EmailSender',
  },
  extra: {
    userId: user.id,
    email: user.email,
    requestId: request.headers.get('x-request-id'),
  },
  level: 'error',
});
```

### Filtering Errors

Filter out known errors in Sentry config:

```typescript
// In sentry.client.config.ts or sentry.server.config.ts
beforeSend(event, hint) {
  // Filter out third-party errors
  if (event.exception?.values?.[0]?.value?.includes('godaddy')) {
    return null; // Don't send
  }
  return event;
}
```

### Environment-Specific Configuration

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: process.env.NODE_ENV === 'development',
});
```

## Integration with Existing Error Handling

Sentry works alongside existing error handling:

- **API Routes**: Errors are caught by Sentry automatically
- **Client Components**: React Error Boundaries can work with Sentry
- **Console Errors**: Already filtered by `lib/errorHandler.js` (third-party errors)

## Monitoring Dashboard

Access your Sentry dashboard:

**URL**: https://sentry.io/organizations/ignite-strategies/projects/ignitebd-logge/

**Key Sections:**
- **Issues**: List of all errors
- **Performance**: Transaction monitoring
- **Releases**: Track deployments
- **Settings**: Configure alerts, integrations

## Alerts & Notifications

Set up alerts in Sentry:

1. Go to **Settings → Alerts**
2. Create alert rules:
   - New error occurs
   - Error rate spikes
   - Performance degradation
3. Configure notifications:
   - Email
   - Slack
   - PagerDuty
   - etc.

## Cost Considerations

**Free Tier Includes:**
- 5,000 errors/month
- 10,000 performance units/month
- 1 project

**Current Configuration:**
- 100% trace sample rate (can reduce in production)
- 10% session replay (already optimized)

**To Reduce Costs:**
- Lower `tracesSampleRate` to 0.1 (10%) in production
- Lower `replaysSessionSampleRate` to 0.01 (1%)
- Filter out noisy errors

## Related Files

- `lib/errorHandler.js` - Client-side error filtering (third-party errors)
- `app/api/**/route.js` - API routes (errors auto-captured)
- `next.config.mjs` - Sentry webpack plugin configuration

## Support

- **Sentry Docs**: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Sentry Dashboard**: https://sentry.io/organizations/ignite-strategies/
- **Project**: ignitebd-logge

---

**Last Updated**: December 2024  
**Sentry Version**: @sentry/nextjs v8.0.0  
**Next.js Version**: 15.4.8

