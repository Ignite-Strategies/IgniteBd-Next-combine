# Next.js Build Safety Audit & Static Export Guide

**Last Updated**: January 2025  
**Next.js Version**: 16.0.1  
**Project**: IgniteBD Next Combine

---

## Executive Summary

This repository is **NOT configured for static export** (`next export`). It is a **fully dynamic application** that requires:

- Runtime database connections (Prisma)
- Firebase authentication (client + admin)
- Server-side API routes
- Client-side hydration patterns

**Static builds will fail** because:
1. All pages are client components requiring runtime data
2. Prisma is used in API routes (requires database at build time if statically generated)
3. Firebase client SDK initializes in root layout
4. Environment variables are accessed at runtime
5. No static generation configuration exists

**This is intentional** - the app is designed as a dynamic, authenticated SaaS application.

---

## Repository Structure

### Directory Layout

```
src/
├── app/                          # Next.js App Router
│   ├── (authenticated)/          # Route group: authenticated pages
│   │   ├── contacts/            # Contact management
│   │   ├── companies/          # Company management
│   │   ├── personas/           # Persona builder
│   │   ├── products/           # Product management
│   │   ├── proposals/          # Proposal builder
│   │   ├── workpackages/       # Work package management
│   │   ├── client-operations/  # Client operations
│   │   ├── outreach/           # Email outreach
│   │   ├── pipelines/          # Deal pipelines
│   │   └── ...                 # Other feature pages
│   ├── (client-portal)/        # Route group: client portal
│   ├── (client)/               # Route group: client-facing
│   ├── (onboarding)/           # Route group: onboarding flow
│   ├── (public)/               # Route group: public pages
│   ├── api/                    # API routes (server-only)
│   │   ├── contacts/          # Contact CRUD
│   │   ├── company/           # Company operations
│   │   ├── enrich/            # Enrichment services
│   │   ├── personas/         # Persona generation
│   │   ├── proposals/        # Proposal operations
│   │   └── ...               # Other API endpoints
│   ├── layout.js              # Root layout (server component)
│   ├── page.js                # Root page (redirects to /splash)
│   └── providers.jsx          # Client providers wrapper
├── components/                  # React components
│   ├── AppShell.jsx           # Main app shell (client)
│   ├── Sidebar.jsx            # Sidebar navigation (client)
│   ├── Navigation.jsx         # Top navigation (client)
│   └── ...                    # Feature components
├── lib/                        # Utilities and services
│   ├── firebase.js            # Firebase client SDK (CLIENT-ONLY)
│   ├── firebaseClient.js      # Firebase app init (CLIENT-ONLY)
│   ├── firebaseAdmin.js       # Firebase admin SDK (SERVER-ONLY)
│   ├── prisma.js              # Prisma client (SERVER-ONLY)
│   ├── apollo.ts              # Apollo API client (SERVER-ONLY)
│   ├── api.js                 # Axios client (CLIENT-ONLY)
│   └── ...                    # Other utilities
├── hooks/                      # React hooks
│   ├── useCompanyHydration.js # Company data hydration
│   ├── useWorkPackageHydration.js # Work package hydration
│   └── ...                    # Other hooks
└── context/                    # React contexts
    └── ActivationContext.jsx  # Activation state
```

---

## Route Organization

### Route Groups

The app uses Next.js route groups to organize pages:

1. **`(authenticated)/`** - Main application pages
   - Requires authentication
   - Shows navigation and sidebar
   - All pages are client components

2. **`(client-portal)/`** - Client portal pages
   - Separate authentication flow
   - Client-facing interface

3. **`(client)/`** - Client review pages
   - Public review interfaces
   - No authentication required

4. **`(onboarding)/`** - Onboarding flow
   - Welcome, company setup, profile setup
   - Initial user journey

5. **`(public)/`** - Public pages
   - Sign in, sign up, splash
   - No authentication required

### Route Patterns

**All page components are client components** (`'use client'`):
- Pages use React hooks (`useState`, `useEffect`, `useRouter`)
- Pages access `localStorage` for `companyHQId`
- Pages make API calls from the client
- Pages require interactive UI

**Example:**
```jsx
// src/app/(authenticated)/contacts/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  // ... client-side logic
}
```

---

## Component Architecture

### Server vs Client Components

#### Server Components (Default)
- **Root Layout** (`app/layout.js`) - Server component
  - No `'use client'` directive
  - Imports `Providers` (client component)
  - Uses Next.js font optimization

#### Client Components (All Pages)
- **All page components** - Client components
  - Must use `'use client'` directive
  - Can use React hooks
  - Can access browser APIs (`window`, `localStorage`)
  - Can make API calls

#### Component Hierarchy

```
RootLayout (Server)
  └── Providers (Client)
       └── AppShell (Client)
            └── Page Components (Client)
                 └── Feature Components (Client)
```

**Key Pattern**: Server components can import client components, but client components cannot import server components directly.

---

## Service Initialization

### Firebase

#### Client SDK (`lib/firebaseClient.js` + `lib/firebase.js`)
- **Location**: `src/lib/firebaseClient.js`, `src/lib/firebase.js`
- **Type**: Client-only (`'use client'`)
- **Initialization**: 
  - Initialized in `firebaseClient.js` using `initializeApp()`
  - Imported in `providers.jsx` (client component)
  - Uses `NEXT_PUBLIC_FIREBASE_*` environment variables
- **Usage**: 
  - Authentication (`getAuth()`)
  - Analytics (`getAnalytics()`)
  - Used in all client components

**⚠️ Build Safety**: 
- Firebase client SDK initializes in `providers.jsx`
- This is imported in root layout
- **Will break static export** - Firebase requires browser environment

#### Admin SDK (`lib/firebaseAdmin.js`)
- **Location**: `src/lib/firebaseAdmin.js`
- **Type**: Server-only (no `'use client'`)
- **Initialization**: 
  - Uses `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable
  - Initialized in API routes only
  - Lazy initialization (checks if already initialized)
- **Usage**: 
  - Token verification in API routes
  - User management
  - Only used in `/app/api/*` routes

**✅ Build Safety**: 
- Only used in API routes (server-side)
- Not imported in pages or components
- Safe for dynamic builds

### Prisma

- **Location**: `src/lib/prisma.js`
- **Type**: Server-only
- **Initialization**: 
  - Singleton pattern using `globalThis`
  - Uses `DATABASE_URL` environment variable
  - Generated via `prisma generate`
- **Usage**: 
  - **ONLY in API routes** (`/app/api/*`)
  - Never imported in client components
  - Never imported in page components

**✅ Build Safety**: 
- Prisma is only used in API routes
- API routes are server-side only
- **Will break static export** - requires database connection

**Example:**
```javascript
// src/app/api/contacts/route.js
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const contacts = await prisma.contact.findMany();
  // ...
}
```

### Apollo API

- **Location**: `src/lib/apollo.ts`
- **Type**: Server-only (TypeScript)
- **Initialization**: 
  - Uses `APOLLO_API_KEY` environment variable
  - No client-side initialization
- **Usage**: 
  - **ONLY in API routes** for enrichment
  - `/app/api/contacts/enrich/*` routes
  - `/app/api/enrich/*` routes

**✅ Build Safety**: 
- Only used in API routes
- Not imported in client components
- Safe for dynamic builds

### Microsoft Graph

- **Location**: `src/lib/microsoftGraph*.js`
- **Type**: Server-only
- **Usage**: 
  - **ONLY in API routes**
  - `/app/api/microsoft/*` routes
  - OAuth callback handling

**✅ Build Safety**: 
- Only used in API routes
- Safe for dynamic builds

---

## Hydration Patterns

### Hydration Architecture

The app uses a **client-side hydration pattern** with localStorage caching:

1. **Initial Load**: Check localStorage for cached data
2. **API Fetch**: Fetch fresh data from API routes
3. **Update Cache**: Store in localStorage for next load
4. **Render**: Use cached data for fast initial render

### Hydration Hooks

#### `useCompanyHydration`
- **Location**: `src/hooks/useCompanyHydration.js`
- **Purpose**: Hydrates companyHQ and all related data
- **Pattern**:
  ```javascript
  const { data, loading, hydrated, refresh } = useCompanyHydration(companyHQId);
  ```
- **localStorage Keys**:
  - `companyHydration_{companyHQId}` - Full cached object
  - `companyHQ`, `companyHQId` - Company data
  - `personas`, `contacts`, `products`, etc. - Feature data

#### `useWorkPackageHydration`
- **Location**: `src/hooks/useWorkPackageHydration.js`
- **Purpose**: Hydrates work package data
- **Pattern**: Similar to `useCompanyHydration`

### Hydration Flow

```
Page Load
  ↓
Check localStorage (instant render)
  ↓
Fetch from API (background)
  ↓
Update localStorage
  ↓
Re-render with fresh data
```

**⚠️ Build Safety**: 
- Hydration relies on client-side API calls
- Requires runtime API routes
- **Will break static export** - no API routes in static builds

---

## Static Generation (SSG) Analysis

### Current State

**No static generation is configured or used.**

All pages are:
- Client components (`'use client'`)
- Dynamic (require runtime data)
- Authenticated (require user context)

### Explicit Dynamic Routes

Only **2 routes** explicitly set `dynamic = 'force-dynamic'`:

1. **`/assessment/results/layout.js`**
   ```javascript
   export const dynamic = 'force-dynamic';
   export const dynamicParams = true;
   ```

2. **`/client-operations/execution/timelines/page.jsx`**
   ```javascript
   export const dynamic = 'force-dynamic';
   export const dynamicParams = true;
   ```

These are **redundant** because all pages are already client components (which are dynamic by default).

### No Static Generation

- ❌ No `generateStaticParams()` functions
- ❌ No `getStaticProps()` (Pages Router pattern)
- ❌ No `generateMetadata()` with static data
- ❌ No static route segments

---

## What Breaks Static Builds

### 1. Firebase Client SDK in Root Layout

**Problem**: 
```jsx
// src/app/providers.jsx
'use client';
import '@/lib/firebase'; // ← Firebase initializes here
```

Firebase client SDK requires:
- Browser environment (`window`, `document`)
- Runtime environment variables
- Cannot be statically generated

**Impact**: 
- Static export will fail when trying to bundle Firebase
- Firebase initialization code runs at build time (fails)

**Solution**: 
- Keep as dynamic app (current state)
- Or: Lazy-load Firebase only in authenticated routes

### 2. Prisma in API Routes

**Problem**: 
- API routes use Prisma to query database
- Static export doesn't include API routes
- Even if included, Prisma requires database connection at build time

**Impact**: 
- Static export will fail when trying to generate API routes
- Or: API routes won't be included in static build

**Solution**: 
- Keep as dynamic app (current state)
- Or: Move to external API server

### 3. Environment Variables at Runtime

**Problem**: 
```javascript
// src/lib/firebaseClient.js
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'fallback',
  // ...
};
```

Client components access `process.env.NEXT_PUBLIC_*` at runtime.

**Impact**: 
- Static export embeds env vars at build time
- Runtime changes won't be reflected

**Solution**: 
- Current pattern is fine for dynamic builds
- For static export: Use build-time env vars only

### 4. Client-Side API Calls

**Problem**: 
- All pages make API calls from client
- API routes are server-side only
- Static export has no server

**Impact**: 
- Pages will fail to load data in static build
- API calls will 404

**Solution**: 
- Keep as dynamic app (current state)
- Or: Use external API server for static builds

### 5. localStorage Access

**Problem**: 
- Pages access `localStorage` on mount
- `localStorage` is browser-only
- Static generation runs on server (no `localStorage`)

**Impact**: 
- Hydration mismatches
- Server-rendered HTML won't match client

**Solution**: 
- Current pattern is fine for dynamic builds
- For static export: Use `useEffect` guards (already done)

---

## Rules to Avoid Static-Build Failures

### ✅ DO: Current Patterns (Safe for Dynamic Builds)

1. **Keep all pages as client components**
   ```jsx
   'use client';
   export default function Page() { /* ... */ }
   ```

2. **Use API routes for data fetching**
   ```javascript
   // ✅ Good: API route
   // src/app/api/contacts/route.js
   import { prisma } from '@/lib/prisma';
   export async function GET(request) { /* ... */ }
   ```

3. **Initialize Firebase in client components only**
   ```jsx
   // ✅ Good: Client component
   'use client';
   import '@/lib/firebase';
   ```

4. **Use Prisma only in API routes**
   ```javascript
   // ✅ Good: API route only
   import { prisma } from '@/lib/prisma';
   ```

5. **Guard browser APIs with `typeof window !== 'undefined'`**
   ```javascript
   // ✅ Good: Guarded
   if (typeof window !== 'undefined') {
     const data = localStorage.getItem('key');
   }
   ```

6. **Use `useEffect` for client-only code**
   ```jsx
   useEffect(() => {
     // Client-only code here
   }, []);
   ```

### ❌ DON'T: Patterns That Break Static Builds

1. **Don't import Prisma in pages or components**
   ```jsx
   // ❌ Bad: Prisma in client component
   'use client';
   import { prisma } from '@/lib/prisma';
   ```

2. **Don't import Firebase Admin in client components**
   ```jsx
   // ❌ Bad: Admin SDK in client
   'use client';
   import { admin } from '@/lib/firebaseAdmin';
   ```

3. **Don't access `localStorage` in server components**
   ```jsx
   // ❌ Bad: localStorage in server component
   export default function Page() {
     const data = localStorage.getItem('key'); // Error!
   }
   ```

4. **Don't use browser APIs in server components**
   ```jsx
   // ❌ Bad: window in server component
   export default function Page() {
     const url = window.location.href; // Error!
   }
   ```

5. **Don't make direct database calls in pages**
   ```jsx
   // ❌ Bad: Direct Prisma in page
   import { prisma } from '@/lib/prisma';
   export default async function Page() {
     const data = await prisma.contact.findMany(); // Works but breaks SSG
   }
   ```

---

## Patterns to Follow Going Forward

### 1. Service Initialization Pattern

**Firebase Client**:
```jsx
// ✅ Pattern: Initialize in client component
'use client';
import '@/lib/firebase'; // Safe: client component
```

**Firebase Admin**:
```javascript
// ✅ Pattern: Only in API routes
// src/app/api/some-route/route.js
import { admin } from '@/lib/firebaseAdmin'; // Safe: API route
```

**Prisma**:
```javascript
// ✅ Pattern: Only in API routes
// src/app/api/some-route/route.js
import { prisma } from '@/lib/prisma'; // Safe: API route
```

### 2. Data Fetching Pattern

**Client Components**:
```jsx
'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function Page() {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    api.get('/api/contacts').then(res => {
      setData(res.data);
    });
  }, []);
  
  return <div>{/* render data */}</div>;
}
```

**API Routes**:
```javascript
// src/app/api/contacts/route.js
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function GET(request) {
  await verifyFirebaseToken(request);
  const contacts = await prisma.contact.findMany();
  return NextResponse.json({ contacts });
}
```

### 3. Hydration Pattern

```jsx
'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function Page() {
  const [data, setData] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  
  // Step 1: Load from cache
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = localStorage.getItem('data');
    if (cached) {
      setData(JSON.parse(cached));
      setHydrated(true);
    }
  }, []);
  
  // Step 2: Fetch fresh data
  useEffect(() => {
    if (hydrated) return; // Already have cached data
    api.get('/api/data').then(res => {
      setData(res.data);
      localStorage.setItem('data', JSON.stringify(res.data));
      setHydrated(true);
    });
  }, [hydrated]);
  
  return <div>{/* render */}</div>;
}
```

### 4. Environment Variable Pattern

**Client Components**:
```javascript
// ✅ Good: NEXT_PUBLIC_ prefix
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
```

**Server Components / API Routes**:
```javascript
// ✅ Good: No prefix (server-only)
const dbUrl = process.env.DATABASE_URL;
const apiKey = process.env.APOLLO_API_KEY;
```

### 5. Dynamic Import Pattern

```jsx
// ✅ Good: Lazy load heavy components
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  ssr: false, // Don't render on server
});
```

---

## Safe Checklist for Adding New Pages/Features

### Before Adding a New Page

- [ ] **Is it a client component?** → Add `'use client'` directive
- [ ] **Does it need data?** → Use API routes, not direct Prisma
- [ ] **Does it use browser APIs?** → Guard with `typeof window !== 'undefined'`
- [ ] **Does it use localStorage?** → Use `useEffect` hook
- [ ] **Does it need authentication?** → Use Firebase client SDK (already initialized)

### Before Adding a New API Route

- [ ] **Does it need Prisma?** → Import `@/lib/prisma` (server-only)
- [ ] **Does it need Firebase Admin?** → Import `@/lib/firebaseAdmin` (server-only)
- [ ] **Does it need authentication?** → Use `verifyFirebaseToken(request)`
- [ ] **Does it return JSON?** → Use `NextResponse.json()`

### Before Adding a New Service

- [ ] **Is it client-only?** → Add `'use client'` and put in `src/lib/`
- [ ] **Is it server-only?** → No `'use client'`, put in `src/lib/`
- [ ] **Does it use environment variables?** → Use `NEXT_PUBLIC_*` for client, no prefix for server
- [ ] **Does it need initialization?** → Lazy initialize, check if already initialized

### Before Adding a New Component

- [ ] **Does it use hooks?** → Add `'use client'`
- [ ] **Does it have event handlers?** → Add `'use client'`
- [ ] **Does it access browser APIs?** → Add `'use client'`
- [ ] **Is it purely presentational?** → Can be server component (no `'use client'`)

---

## Build Configuration

### Current Configuration

**`next.config.mjs`**:
```javascript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};
```

**No static export configuration** - app is dynamic by design.

### Build Command

```bash
npm run build
# Runs: prisma generate && next build
```

This builds a **dynamic Next.js application** that requires:
- Node.js runtime
- Database connection (for API routes)
- Environment variables

### Deployment Requirements

- **Runtime**: Node.js server (Vercel, Render, etc.)
- **Database**: PostgreSQL (for Prisma)
- **Environment Variables**:
  - `DATABASE_URL` - Prisma connection
  - `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase Admin
  - `NEXT_PUBLIC_FIREBASE_*` - Firebase Client
  - `APOLLO_API_KEY` - Apollo enrichment
  - Other service API keys

---

## Summary

### What We Found

1. **Structure**: Well-organized App Router with route groups
2. **Components**: All pages are client components (intentional)
3. **Services**: Properly separated (client vs server)
4. **Hydration**: Client-side hydration with localStorage caching
5. **API Routes**: Server-side only, use Prisma/Firebase Admin
6. **Static Generation**: Not used (app is fully dynamic)

### What Breaks Static Builds

1. **Firebase Client SDK** in root layout
2. **Prisma** in API routes (requires database)
3. **Client-side API calls** (no server in static build)
4. **localStorage** access (browser-only)
5. **Environment variables** at runtime

### Structural Patterns to Reinforce

1. ✅ **Keep pages as client components** - Current pattern is correct
2. ✅ **Use API routes for data** - Current pattern is correct
3. ✅ **Separate client/server services** - Current pattern is correct
4. ✅ **Guard browser APIs** - Current pattern is correct
5. ✅ **Use hydration hooks** - Current pattern is correct

### Going Forward

- **Don't try to make this app static** - It's designed to be dynamic
- **Keep current patterns** - They're safe for dynamic builds
- **Follow the checklist** - When adding new features
- **Document exceptions** - If you need to break patterns

---

**Last Updated**: January 2025  
**Next.js Version**: 16.0.1  
**Build Type**: Dynamic (not static)  
**Status**: ✅ Safe for dynamic builds, ❌ Not safe for static export

