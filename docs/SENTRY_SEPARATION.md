# Sentry Client/Server Separation Guide

## Overview

Sentry is configured with **strict separation** between client-side and server-side code to prevent SSR/prerendering errors and ensure proper initialization.

## Architecture

### Three Separate Configurations

1. **Client-Side** (`sentry.client.config.ts`)
   - Browser-only initialization
   - Includes Session Replay
   - Loaded via `app/SentryInit.jsx`

2. **Server-Side** (`sentry.server.config.ts`)
   - Node.js runtime only
   - No Session Replay (not available)
   - Loaded via `instrumentation.ts`

3. **Edge Runtime** (`sentry.edge.config.ts`)
   - Edge runtime only
   - No Session Replay (not available)
   - Loaded via `instrumentation.ts`

## File Structure

```
├── sentry.client.config.ts    # Client-side config (browser only)
├── sentry.server.config.ts     # Server-side config (Node.js only)
├── sentry.edge.config.ts       # Edge runtime config (Edge only)
├── instrumentation.ts          # Loads server/edge configs
└── app/
    └── SentryInit.jsx          # Loads client config
```

## Initialization Flow

### Client-Side Initialization

```
app/layout.js
  └── SentryInit.jsx ('use client')
      └── imports sentry.client.config.ts
          └── Sentry.init() (only if typeof window !== 'undefined')
```

**Key Points:**
- `SentryInit.jsx` is a client component (`'use client'`)
- Client config checks `typeof window !== 'undefined'` before initializing
- Prevents SSR/prerendering errors with `replayIntegration`

### Server-Side Initialization

```
Next.js Startup
  └── instrumentation.ts (auto-loaded)
      └── if NEXT_RUNTIME === 'nodejs'
          └── imports sentry.server.config.ts
              └── Sentry.init() (server-side)
```

**Key Points:**
- Server config is loaded automatically via `instrumentation.ts`
- Only runs in Node.js runtime
- Does NOT include `replayIntegration` (client-only feature)

### Edge Runtime Initialization

```
Next.js Startup
  └── instrumentation.ts (auto-loaded)
      └── if NEXT_RUNTIME === 'edge'
          └── imports sentry.edge.config.ts
              └── Sentry.init() (edge runtime)
```

## Usage Patterns

### ✅ Correct: Using Sentry in API Routes

```typescript
// app/api/example/route.ts
import * as Sentry from '@sentry/nextjs';

export async function GET() {
  try {
    // your code
  } catch (error) {
    Sentry.captureException(error); // ✅ Correct - server context
    throw error;
  }
}
```

**Why it works:**
- API routes run in server context
- Server config is already initialized via `instrumentation.ts`
- Direct import from `@sentry/nextjs` works correctly

### ✅ Correct: Using Sentry in Server Utilities

```typescript
// lib/serverError.ts
import * as Sentry from '@sentry/nextjs';

export function handleServerError(error: unknown) {
  Sentry.captureException(error); // ✅ Correct - server context
  // ...
}
```

**Why it works:**
- Server-only utility (no `'use client'`)
- Server config is already initialized
- Direct import works correctly

### ✅ Correct: Using Sentry in Client Error Boundaries

```typescript
// app/error.tsx
'use client';

import * as Sentry from '@sentry/nextjs';

export default function Error({ error }) {
  useEffect(() => {
    Sentry.captureException(error); // ✅ Correct - client context
  }, [error]);
}
```

**Why it works:**
- Client component (`'use client'`)
- Client config is already initialized via `SentryInit.jsx`
- Direct import works correctly in client context

### ❌ Incorrect: Importing Config Files Directly

```typescript
// ❌ DON'T DO THIS
import './sentry.client.config'; // In server component
import './sentry.server.config'; // In client component
```

**Why it fails:**
- Client config includes `replayIntegration` which fails in SSR
- Server config uses `SENTRY_DSN` (not `NEXT_PUBLIC_SENTRY_DSN`)
- Mixes concerns and causes build errors

## Key Rules

### Rule 1: Config Files Are Loaded Automatically

- **Client config**: Loaded via `SentryInit.jsx` (don't import manually)
- **Server config**: Loaded via `instrumentation.ts` (don't import manually)
- **Edge config**: Loaded via `instrumentation.ts` (don't import manually)

### Rule 2: Use Direct Sentry Import for Capturing

```typescript
// ✅ Correct - anywhere
import * as Sentry from '@sentry/nextjs';
Sentry.captureException(error);
```

The `@sentry/nextjs` package automatically uses the correct initialized config based on runtime.

### Rule 3: Client Config Must Guard Against SSR

```typescript
// sentry.client.config.ts
if (typeof window !== 'undefined') {
  Sentry.init({
    // ... config
    integrations: [
      Sentry.replayIntegration({ ... }), // ✅ Safe - browser only
    ],
  });
}
```

### Rule 4: Server/Edge Configs Never Include Replay

```typescript
// sentry.server.config.ts
Sentry.init({
  // ... config
  // ❌ NO replayIntegration here - it's client-only
});
```

## Common Issues & Solutions

### Issue: `replayIntegration is not a function`

**Cause:** Client config being evaluated during SSR/prerendering

**Solution:** Guard initialization with `typeof window !== 'undefined'`

```typescript
// ✅ Fixed
if (typeof window !== 'undefined') {
  Sentry.init({ ... });
}
```

### Issue: Sentry not capturing errors

**Cause:** Config not initialized in the correct runtime

**Solution:** 
- Client errors → Ensure `SentryInit.jsx` wraps app in `layout.js`
- Server errors → Ensure `instrumentation.ts` exists and loads server config
- Edge errors → Ensure `instrumentation.ts` loads edge config

### Issue: Build fails with Sentry errors

**Cause:** Config file imported in wrong context

**Solution:** Never import config files directly - they're loaded automatically

## Verification Checklist

- [ ] `sentry.client.config.ts` guards with `typeof window !== 'undefined'`
- [ ] `sentry.server.config.ts` does NOT include `replayIntegration`
- [ ] `sentry.edge.config.ts` does NOT include `replayIntegration`
- [ ] `instrumentation.ts` only loads server/edge configs
- [ ] `SentryInit.jsx` only loads client config
- [ ] No direct imports of config files in components/routes
- [ ] All Sentry usage uses `import * as Sentry from '@sentry/nextjs'`

## Files Summary

| File | Runtime | Purpose | Loaded By |
|------|---------|---------|-----------|
| `sentry.client.config.ts` | Browser | Client-side tracking + Replay | `app/SentryInit.jsx` |
| `sentry.server.config.ts` | Node.js | Server-side tracking | `instrumentation.ts` |
| `sentry.edge.config.ts` | Edge | Edge runtime tracking | `instrumentation.ts` |
| `instrumentation.ts` | Server/Edge | Auto-loads server/edge configs | Next.js |
| `app/SentryInit.jsx` | Client | Loads client config | `app/layout.js` |

## Related Files

- `lib/serverError.ts` - Server-side error handler (uses Sentry)
- `app/error.tsx` - Client error boundary (uses Sentry)
- `app/global-error.tsx` - Global error boundary (uses Sentry)
- `app/api/test-sentry/route.js` - Test route (uses Sentry)

---

**Last Updated:** December 2024  
**Sentry Version:** @sentry/nextjs v8.0.0

