# Architecture Overview

Complete architecture guide for IgniteBD Next.js stack.

## Table of Contents

1. [Premise](#premise)
2. [Stack Overview](#stack-overview)
3. [Architecture Principles](#architecture-principles)
4. [Next.js App Router Structure](#nextjs-app-router-structure)
5. [API Architecture](#api-architecture)
6. [Authentication Flow](#authentication-flow)
7. [Database & Prisma](#database--prisma)
8. [Core Data Model Relationships](#core-data-model-relationships)
9. [Development Workflow](#development-workflow)
10. [Deployment](#deployment)
11. [Key Differences from Original Stack](#key-differences-from-original-stack)

---

## Premise

**IgniteBD is a business development platform designed to help professional services clients with systematic outreach, relationship building, and growth acceleration.**

The core mission: **Attract → Engage → Nurture**

- **Attract**: Build awareness through content, branding, SEO, and advertising
- **Engage**: Convert prospects into meaningful relationships through outreach, events, and personalized campaigns
- **Nurture**: Maintain and deepen relationships to drive long-term business growth

---

## Stack Overview

### Combined Stack: `IgniteBd-Next-combine`

- **Framework**: Next.js 14+ (App Router)
- **Frontend**: React 18 (Server & Client Components)
- **Backend**: Next.js API Routes (replacing Express)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Firebase Auth (client SDK + Admin SDK)
- **Styling**: Tailwind CSS
- **State Management**: React Context API + localStorage hydration
- **HTTP Client**: Axios (with Firebase token interceptors)
- **Deployment**: Vercel (full-stack deployment)
- **Production URL**: https://app.ignitegrowth.biz

### Key Difference from Original Stack

**Original Stack** (`Ignite-frontend-production` + `ignitebd-backend`):
- Separate React (Vite) frontend on Vercel
- Separate Express backend on Render
- Cross-origin API calls

**Next.js Combined Stack** (`IgniteBd-Next-combine`):
- **Monorepo**: Frontend + Backend in single Next.js app
- **API Routes**: Next.js API routes (`/app/api/**/route.js`) replace Express routes
- **Server Components**: Can render on server for better performance
- **Client Components**: Interactive UI with `'use client'` directive
- **Single Deployment**: Everything deploys together on Vercel

---

## Architecture Principles

### Core Architecture Pattern

**Contact + Company First Architecture** - Designed to drive business growth through systematic relationship management.

This architecture emphasizes:
- Multi-tenancy via `CompanyHQId`
- Contact as universal personhood
- Pipeline/stage tracking
- Company relationships (prospect/client companies)

### Key Concepts

1. **Multi-Tenancy**: Everything scoped to `CompanyHQId` (root container)
2. **Universal Personhood**: Contacts represent people across their entire journey
3. **Pipeline Tracking**: Intentional pipeline/stage state management
4. **Company Hierarchy**: CompanyHQ (tenant) vs Company (prospect/client)

---

## Next.js App Router Structure

### Route Organization

```
src/app/
├── (public)/              # Public routes (no auth required)
│   ├── signin/
│   ├── signup/
│   └── splash/
│
├── (onboarding)/          # Onboarding flow (auth required)
│   ├── welcome/           # Owner hydration & routing
│   ├── profilesetup/     # Owner profile completion
│   └── company/
│       ├── create-or-choose/
│       ├── profile/       # CompanyHQ creation
│       └── create-success/
│
├── (authenticated)/       # Main app (auth + company required)
│   ├── growth-dashboard/
│   ├── contacts/
│   │   ├── layout.jsx     # Contacts context hydration
│   │   ├── page.jsx       # People Hub
│   │   ├── upload/
│   │   ├── list-manager/
│   │   ├── deal-pipelines/
│   │   └── [contactId]/
│   ├── outreach/
│   │   ├── layout.jsx     # Campaigns context hydration
│   │   ├── campaigns/
│   │   └── campaigns/[campaignId]/
│   ├── personas/
│   ├── pipelines/
│   │   ├── layout.jsx     # Pipeline context hydration
│   │   └── roadmap/
│   ├── proposals/
│   └── [other feature pages]/
│
└── api/                   # Next.js API Routes (backend)
    ├── owner/
    │   ├── create/route.js
    │   ├── hydrate/route.js
    │   └── [ownerId]/profile/route.js
    ├── contacts/
    ├── company/
    └── [other entities]/
```

### Route Groups Explained

- `(public)`: Routes accessible without authentication
- `(onboarding)`: Routes for new users setting up their account
- `(authenticated)`: Main application routes requiring full setup

Route groups (parentheses) don't affect URLs but allow shared layouts.

---

## API Architecture

### Next.js API Routes vs Express Routes

**Old Pattern (Express):**
```
ignitebd-backend/routes/Owner/IgniteUniversalHydrateRoute.js
→ GET /api/owner/hydrate
```

**New Pattern (Next.js):**
```
src/app/api/owner/hydrate/route.js
→ GET /api/owner/hydrate
```

### API Route Structure

```javascript
// src/app/api/owner/hydrate/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function GET(request) {
  // 1. Verify Firebase token
  const firebaseUser = await verifyFirebaseToken(request);
  
  // 2. Query database
  const owner = await prisma.owner.findUnique({
    where: { firebaseId: firebaseUser.uid },
    include: { /* relations */ }
  });
  
  // 3. Return JSON response
  return NextResponse.json({ success: true, owner });
}
```

### API Client Configuration

**File:** `src/lib/api.js`

```javascript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || '', // Empty = relative URLs (Next.js API routes)
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Interceptor adds Firebase token to all requests
api.interceptors.request.use(async (config) => {
  const user = getAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Important:** If `NEXT_PUBLIC_BACKEND_URL` is empty or unset, API calls use relative URLs and hit Next.js API routes. If set to external URL (e.g., `https://ignitebd-backend.onrender.com`), calls go to external backend.

---

## Authentication Flow

### Complete Onboarding Flow

1. **Sign Up** (`/signup`)
   - Firebase Auth creates user
   - `POST /api/owner/create` creates Owner record
   - Stores `ownerId` in localStorage
   - Redirects to `/welcome`

2. **Welcome Hydration** (`/welcome`)
   - `GET /api/owner/hydrate` loads full Owner data
   - Stores `owner`, `companyHQId`, `companyHQ` in localStorage
   - Routes based on completeness:
     - No company → `/company/create-or-choose`
     - Has company → `/growth-dashboard`

3. **Company Setup** (`/company/profile`)
   - `POST /api/companyhq/create` creates CompanyHQ
   - Updates localStorage with new `companyHQId`
   - Redirects to `/growth-dashboard`

4. **Dashboard** (`/growth-dashboard`)
   - Reads from localStorage for fast initial render
   - May refresh data from API as needed

### Firebase Token Management

- **Client-side**: Firebase Auth SDK provides tokens
- **API Routes**: `verifyFirebaseToken()` middleware validates tokens
- **Automatic**: Axios interceptor adds token to all requests

### Authentication Pattern: Read vs Write

**Owner-Based Architecture Pattern:**

The owner is authenticated once via Firebase session. Data is scoped by `companyHQId` (tenant identifier). We don't need to verify the token on every read operation.

#### Route Authentication Strategy

**GET Requests (Read Operations) → `optionalAuth`**
- **Purpose:** "Show me stuff" - Displaying data
- **Middleware:** `optionalAuth`
- **Why:** Data is already scoped by `companyHQId` in query params
- **Benefits:**
  - Better UX: No 401 errors on page loads
  - Better performance: Fewer token verifications
  - Simpler flow: Owner authenticated once, then scoped by tenant

**POST/PUT/DELETE (Write Operations) → `verifyFirebaseToken`**
- **Purpose:** "Change stuff" - Creating, updating, or deleting data
- **Middleware:** `verifyFirebaseToken`
- **Why:** Security - prevent unauthorized modifications
- **Requirement:** Valid Firebase token must be present

**Pattern Summary:**
- ✅ **GET** = `optionalAuth` (scoped by `companyHQId`)
- 🔒 **POST/PUT/DELETE** = `verifyFirebaseToken` (requires valid token)

---

## Database & Prisma

### Prisma Setup

**File:** `prisma/schema.prisma`
- Shared schema with original backend
- Same models: Owner, CompanyHQ, Contact, Pipeline, etc.

**Client:** `src/lib/prisma.js`
```javascript
import { PrismaClient } from '@prisma/client';
export const prisma = globalThis.prisma || new PrismaClient();
```

### Database Connection

- **Development**: Local PostgreSQL or connection string in `.env.local`
- **Production**: Vercel environment variable `DATABASE_URL`
- **Migrations**: `npx prisma migrate dev` (same as Express backend)

---

## Core Data Model Relationships

### Owner → CompanyHQ Relationship

The `CompanyHQ` model represents the tenant boundary (multi-tenancy root). It can be owned or managed through multiple relationships:

**Schema:**
```prisma
model CompanyHQ {
  id            String   @id @default(cuid())
  ownerId       String?  // Owner.id (legacy Owner model) - optional
  contactOwnerId String? // Contact.id (for Contact-owned HQs)
  managerId     String?  // Owner.id (for managers)
  
  owner         Owner?   @relation("OwnerOf", fields: [ownerId], references: [id])
  contactOwner   Contact? @relation("ContactOwnedHQs", fields: [contactOwnerId], references: [id])
  manager       Owner?   @relation("ManagerOf", fields: [managerId], references: [id])
}
```

**Relationship Types:**

1. **Owner Ownership** (`ownerId` → `Owner.id`)
   - Legacy pattern: Owner directly owns CompanyHQ
   - Used for traditional owner-tenant relationships
   - Optional field (allows Contact-owned HQs)

2. **Contact Ownership** (`contactOwnerId` → `Contact.id`)
   - Modern pattern: Contact can own CompanyHQ
   - Enables Contact to become a tenant owner
   - Supports universal personhood model

3. **Manager Relationship** (`managerId` → `Owner.id`)
   - Allows Owner to manage CompanyHQ without owning it
   - Supports multi-HQ management scenarios

**Key Points:**
- `ownerId` is **optional** - CompanyHQ can exist without an Owner (Contact-owned)
- Both `ownerId` and `contactOwnerId` can coexist (hybrid ownership)
- `CompanyHQ` is the **tenant boundary** - all data is scoped by `companyHQId`

### CompanyHQ → Company Relationship

The `Company` model represents prospect/client companies within a tenant's scope:

**Schema:**
```prisma
model Company {
  id          String    @id @default(cuid())
  companyHQId String    // Required - links to tenant
  companyName String
  
  companyHQ   CompanyHQ @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  workPackages WorkPackage[]
}
```

**Relationship:**
- `Company.companyHQId` → `CompanyHQ.id` (required, cascade delete)
- **Tenant Boundary**: All Companies belong to a CompanyHQ (tenant)
- **Prospect/Client Companies**: These are the companies you're doing business with, not your own tenant

### WorkPackage → Client Portal Connection

WorkPackages bridge the owner-side operations with the client portal through `workPackageId`:

**Schema:**
```prisma
model WorkPackage {
  id        String   @id @default(cuid())
  contactId String   // Contact who is the client
  companyId String?  // Company the work package is for
  
  contact   Contact  @relation(fields: [contactId], references: [id])
  company   Company? @relation(fields: [companyId], references: [id])
}
```

**Connection Flow:**

1. **Owner Side** (IgniteBD Main App):
   - WorkPackages are created and managed by Owners
   - Scoped by `CompanyHQ` (tenant boundary)
   - Linked to `Contact` and `Company` (prospect/client)

2. **Client Portal** (Separate Next.js App):
   - Clients access via `workPackageId` stored in localStorage
   - Authentication: `Contact.firebaseUid` → Firebase Auth
   - Authorization: Validates `WorkPackage.companyId` matches `Contact.contactCompanyId`
   - Access Pattern: `Contact` → `Contact.contactCompanyId` → `WorkPackage.companyId` → validates access

**Client Portal Access Pattern:**
```
Firebase UID → Contact (via firebaseUid)
  → Contact.contactCompanyId
  → WorkPackage.companyId (must match)
  → Full WorkPackage with phases, items, deliverables
```

**Key Points:**
- `workPackageId` is the **bridge identifier** between owner and client systems
- Client portal validates ownership via `companyId` matching
- WorkPackages are tenant-scoped through `Company.companyHQId`
- Client portal is a separate Next.js app (`ignitebd-clientportal`) sharing the same database

**Data Flow Diagram:**
```
Owner (firebaseId)
  ↓
CompanyHQ (ownerId/contactOwnerId)
  ↓
Company (companyHQId) ← Tenant boundary
  ↓
WorkPackage (companyId)
  ↓
Client Portal (workPackageId) ← Access via localStorage
```

---

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables (.env.local)
DATABASE_URL="postgresql://..."
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
NEXT_PUBLIC_BACKEND_URL=""  # Empty = use Next.js API routes

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

**Runs on:** http://localhost:3000

### API Development

- **Next.js API Routes**: Edit files in `src/app/api/**/route.js`
- **Hot Reload**: Changes reflect immediately (no separate server restart)
- **Database**: Same Prisma client, same database as Express backend

### Testing API Routes

```bash
# Test locally
curl http://localhost:3000/api/owner/hydrate \
  -H "Authorization: Bearer <firebase-token>"

# Test in browser
# Navigate to page that calls API, check Network tab
```

---

## Deployment

### Vercel Deployment

1. **Connect Repository**: Link GitHub repo to Vercel
2. **Environment Variables**:
   - `DATABASE_URL` - PostgreSQL connection string
   - `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase Admin SDK JSON
   - `NEXT_PUBLIC_BACKEND_URL` - Leave empty or unset (use Next.js API routes)
3. **Build**: Vercel automatically runs `npm run build`
4. **Deploy**: Every push to main triggers deployment

### Production URLs

- **App**: https://app.ignitegrowth.biz
- **API Routes**: https://app.ignitegrowth.biz/api/owner/hydrate (same domain)

### Database

- Same PostgreSQL database as Express backend
- Shared Prisma schema
- Can run migrations from either codebase

---

## Key Differences from Original Stack

### 1. API Routes Location

**Old:**
```
ignitebd-backend/routes/Owner/CreateOwnerRoute.js
```

**New:**
```
src/app/api/owner/create/route.js
```

### 2. Routing

**Old (React Router):**
```javascript
import { useNavigate } from 'react-router-dom';
navigate('/contacts');
```

**New (Next.js):**
```javascript
import { useRouter } from 'next/navigation';
router.push('/contacts');
```

### 3. Links

**Old (React Router):**
```javascript
import { Link } from 'react-router-dom';
<Link to="/contacts">Contacts</Link>
```

**New (Next.js):**
```javascript
import Link from 'next/link';
<Link href="/contacts">Contacts</Link>
```

### 4. Server vs Client Components

**Server Component** (default):
- Renders on server
- No `'use client'` directive
- Can't use hooks or browser APIs
- Good for static content

**Client Component**:
- Must have `'use client'` at top
- Renders on client
- Can use hooks, state, browser APIs
- Required for interactive UI

### 5. Data Fetching

**Old (Express):**
- All data fetching in client components
- Axios calls to external backend

**New (Next.js):**
- Can fetch in Server Components (direct Prisma calls)
- Can fetch in Client Components (API routes)
- Can fetch in API routes (for client components)

---

## Related Documentation

- **`docs/architecture/hydration.md`** - Hydration architecture (ownerId → companyHQId → everything)
- **`docs/architecture/contacts.md`** - Contact management architecture
- **`docs/architecture/hooks.md`** - React hooks guide
- **`docs/architecture/client-operations.md`** - Client operations architecture

---

## Current Status

**✅ Completed:**
- Next.js App Router structure
- Route groups (public, onboarding, authenticated)
- API routes for Owner, Contacts, Company
- Hydration flows (Welcome, Contacts, Outreach, Pipelines)
- Feature-level layouts with context
- Dynamic routes ([contactId], [personaId], [proposalId])

**🚧 In Progress:**
- Full API route migration from Express
- Contact upload CSV processing
- Campaign management
- Proposal builder

**📋 Future:**
- Server Components for better performance
- Streaming SSR
- Optimistic UI updates
- Real-time features

---

**Last Updated**: November 2025  
**Stack Version**: 2.0.0 (Next.js Combined)  
**Architecture**: Contact + Company First  
**Multi-Tenancy**: CompanyHQ-scoped  
**Authentication**: Firebase Auth  
**Deployment**: Vercel (Full-Stack)

