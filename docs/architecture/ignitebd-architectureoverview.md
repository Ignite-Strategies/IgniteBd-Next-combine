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
9. [Ecosystem Intelligence Architecture](#ecosystem-intelligence-architecture)
10. [Events Architecture](#events-architecture)
11. [Personas Architecture](#personas-architecture)
12. [Development Workflow](#development-workflow)
13. [Deployment](#deployment)
14. [Key Differences from Original Stack](#key-differences-from-original-stack)

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
│   │   ├── page.jsx       # Personas list
│   │   ├── builder/       # Persona builder
│   │   ├── [personaId]/   # Persona detail
│   │   └── build-from-contacts/
│   ├── ecosystem/
│   │   └── associations/  # Ecosystem Intelligence - Associations
│   ├── events/
│   │   ├── page.jsx       # Events hub
│   │   └── build-from-persona/  # Event recommendations
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
    ├── personas/
    │   ├── generate/route.ts
    │   ├── [personaId]/route.ts
    │   ├── [personaId]/product-fit/route.ts
    │   └── [personaId]/bd-intel/route.ts
    ├── ecosystem/
    │   └── org/
    │       └── ingest/route.ts  # EcosystemOrg ingestion
    ├── events/
    │   ├── meta/
    │   │   └── ingest/route.ts  # EventMeta catalog
    │   ├── opp/
    │   │   └── generate/route.ts  # BDEventOpp generation
    │   └── save/route.ts
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

**Entry Point:** Root `/` → Redirects to `/splash`

#### 1. **Splash Screen** (`/splash`)
**Purpose:** Initial branding page with auto-redirect and auth detection

**Features:**
- 2-second display with flame icon (SVG) animation
- Firebase auth state check using `onAuthStateChanged`
- Auto-redirects based on auth status:
  - Authenticated → `/welcome`
  - Not authenticated → `/signup`

**Design Pattern:**
- Red gradient background: `from-red-600 via-red-700 to-red-800`
- Large centered flame SVG icon
- "IgniteGrowth Engine" branding
- "by Ignite Strategies" subtitle

**Implementation:**
```javascript
// app/(public)/splash/page.jsx
useEffect(() => {
  const timer = setTimeout(() => {
    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/welcome');
      } else {
        router.replace('/signup');
      }
    });
  }, 2000);
}, [router]);
```

#### 2. **Sign Up/Sign In** (`/signup`, `/signin`)
**Purpose:** Authentication with Firebase

**Features:**
- Tab switcher: Google OAuth vs Email/Password
- Firebase authentication (client SDK)
- Creates/finds Owner record in database
- Persists session to localStorage
- Redirects to `/welcome` on success

**UI Pattern:**
- Logo at top
- Glass-morphism card: `bg-white/10 backdrop-blur-sm`
- Toggle between auth methods
- Google sign-in with branded button
- Email form with styled inputs
- Link to sign up/sign in (toggle)

**Session Storage (localStorage):**
```javascript
localStorage.setItem('firebaseId', firebaseUser.uid);
localStorage.setItem('ownerId', ownerRecord.id);
localStorage.setItem('email', ownerRecord.email);
localStorage.setItem('firebaseToken', idToken);
```

**API Call:**
```javascript
POST /api/owner/create
Body: {
  firebaseId: result.uid,
  email: result.email,
  firstName: result.name?.split(' ')[0],
  lastName: result.name?.split(' ').slice(1).join(' '),
  photoURL: result.photoURL,
}
```

#### 3. **Welcome Page** (`/welcome`)
**Purpose:** Post-authentication landing before main app

**Features:**
- Uses `useOwner()` hook to fetch user data
- Three states: Loading, Error, Success
- Personalized greeting using owner's name
- Shows company name if available
- "Continue →" button to `/growth-dashboard`

**State Management:**
```javascript
const { owner, loading, hydrated, error } = useOwner();
```

**Loading State:**
- Animated spinner: `animate-spin rounded-full h-16 w-16 border-b-4 border-white`
- "Loading your account..." message
- Red gradient background

**Error State:**
- White card with error message
- "Reload Page" button
- Red gradient background

**Success State:**
- White card with welcome message
- Personalized: "Welcome, {firstName}!" or "Welcome, {email}!"
- Company context: "Ready to manage {companyName}?"
- Continue button to dashboard

**Implementation:**
```javascript
// app/(onboarding)/welcome/page.jsx
const nextRoute = '/growth-dashboard';

const handleContinue = () => {
  router.push(nextRoute);
};
```

**API Hydration:**
```javascript
GET /api/owner/hydrate
Authorization: Bearer <firebaseToken>
Returns: { owner, companyHQ, ... }
```

#### 4. **Company Setup** (if needed)
**Routes:**
- `/company/create-or-choose` - Choose to create or join company
- `/company/profile` - Company profile form

**API Call:**
```javascript
POST /api/companyhq/create
Body: {
  companyName, ownerId, whatYouDo,
  companyStreet, companyCity, companyState,
  companyWebsite, companyIndustry,
  companyAnnualRev, yearsInBusiness, teamSize
}
```

#### 5. **Dashboard** (`/growth-dashboard`)
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

## Ecosystem Intelligence Architecture

### Overview

The Ecosystem Intelligence system maps and analyzes the business development ecosystem through organizations (associations, commercial producers, media, nonprofits, etc.) and their events. This architecture provides a complete "who are they?" → "what events do they produce?" → "should I attend?" intelligence pipeline.

### Core Models

#### EcosystemOrg (The Root)
**File**: `prisma/schema.prisma`

```prisma
model EcosystemOrg {
  id               String   @id @default(cuid())
  
  // Raw ingest
  sourceType       EcosystemOrgSourceType @default(MANUAL)
  rawName          String
  rawWebsite       String?
  rawLocation      String?
  
  // Identity
  normalizedName   String
  organizationType OrganizationType  // ASSOCIATION, COMMERCIAL, MEDIA, NONPROFIT, GOVERNMENT
  
  // AI Enrichment
  description      String?
  whatTheyDo       String?
  howTheyMatter    String?
  industryTags     String[]
  authorityLevel   Int?        // 1–5
  sizeEstimate     String?
  memberTypes      String[]
  
  // BD Intelligence
  personaAlignment Json?       // { personaId: score }
  bdRelevanceScore Int?        // 0–100
  
  // Relations
  eventMetas       EventMeta[]
}
```

**Purpose**: Central intelligence model for all ecosystem organizations. Stores AI-inferred insights about what organizations do, who their members are, and their BD value.

**Enums**:
- `EcosystemOrgSourceType`: MANUAL, CSV, EVENT, AI
- `OrganizationType`: ASSOCIATION, COMMERCIAL, MEDIA, NONPROFIT, GOVERNMENT

#### EventMeta (The Catalog)
**File**: `prisma/schema.prisma`

```prisma
model EventMeta {
  id         String @id @default(cuid())
  
  // Identity
  name       String
  seriesName String?
  eventType  EventType  // ASSOCIATION, COMMERCIAL, MEDIA, INDUSTRY, PRIVATE, CORPORATE
  
  // Organizer Link
  organizerId String?
  organizer   EcosystemOrg? @relation(fields: [organizerId], references: [id])
  
  // Location, Dates, Cost
  city        String?
  state       String?
  country     String?
  startDate   DateTime?
  endDate     DateTime?
  dateRange   String?
  costMin     Int?
  costMax     Int?
  currency    String?
  
  // Source tracking
  sourceType  EventSourceType @default(AI)
  rawJson     Json?
  
  // Relations
  bdEventOpps BDEventOpp[]
}
```

**Purpose**: Global event catalog - "everything that exists". Events are linked to their organizing EcosystemOrg for intelligence inheritance.

**Enums**:
- `EventType`: ASSOCIATION, COMMERCIAL, MEDIA, INDUSTRY, PRIVATE, CORPORATE
- `EventSourceType`: AI, CSV, MANUAL, WEB

#### BDEventOpp (The Analyzer)
**File**: `prisma/schema.prisma`

```prisma
model BDEventOpp {
  id            String @id @default(cuid())
  
  companyHQId   String
  ownerId       String
  
  // Link to global event
  eventMetaId   String
  eventMeta     EventMeta @relation(fields: [eventMetaId], references: [id])
  
  // Link to persona used for analysis
  personaId     String?
  
  // BD scoring
  personaAlignment Int?       // 0–100
  travelBurden     Int?       // 1–10
  costFit          Int?       // 1–10
  ecosystemFit     Int?       // 0–100 from organizer org
  bdOpportunity    Int?       // composite score
  notes            String?
  
  // Status
  status         EventOppStatus @default(CONSIDERING)
  
  // Relations
  eventPlans     EventPlanOpp[]
}
```

**Purpose**: BD-scoped opportunity analysis. Links a global EventMeta to a persona + company context, providing "should I go to this event?" intelligence.

**Status Enum**: CONSIDERING, SHORTLIST, GOING, PASSED

#### EventPlan (Strategy Container)
**File**: `prisma/schema.prisma`

```prisma
model EventPlan {
  id            String @id @default(cuid())
  companyHQId   String
  ownerId       String
  
  name          String      // "Q1 2026 Roadmap"
  description   String?
  year          Int?
  
  // Analytics
  totalCost     Int?
  totalTrips    Int?
  spacingScore  Int?
  
  // Relations (via junction)
  opps          EventPlanOpp[]
}
```

**Purpose**: User's BD master plan - a container for selected event opportunities with analytics.

### Connection Flow

```
EcosystemOrg ───────↘
                    EventMeta ───↘
                                    BDEventOpp ───↘ 
                                                   EventPlan

Persona ─────────────↗
```

**Flow 1: Ingest Organizers**
- CSV/Text/Manual → `/api/ecosystem/org/ingest`
- AI inference enriches with BD intelligence
- Saves to `EcosystemOrg`

**Flow 2: Build EventMeta Catalog**
- Persona + priorities → `/api/events/meta/ingest`
- GPT generates event recommendations
- Extract organizer → fuzzy match `EcosystemOrg`
- Save `EventMeta` linked to organizer

**Flow 3: Generate BDEventOpp**
- `EventMeta` + Persona + Priorities → `/api/events/opp/generate`
- GPT scorer analyzes BD opportunity
- Creates `BDEventOpp` with scores

**Flow 4: Build EventPlan**
- User selects multiple `BDEventOpps`
- Creates `EventPlan` with analytics

### API Routes

#### Ecosystem Org Ingestion
**POST** `/api/ecosystem/org/ingest`
- Accepts: CSV/XLSX file, text list, or single manual entry
- Process: Parse → AI inference → Save `EcosystemOrg`
- Returns: Enriched ecosystem orgs

**GET** `/api/ecosystem/org/ingest`
- Query params: `limit`, `offset`, `organizationType`
- Returns: List of ecosystem orgs

#### EventMeta Catalog
**POST** `/api/events/meta/ingest`
- Body: `{ type: 'persona', data: { personaId, priorities, ... } }`
- Process: Generate events → Match organizer → Save `EventMeta`
- Returns: EventMeta records with organizer links

**GET** `/api/events/meta`
- Query params: `limit`, `offset`, `eventType`
- Returns: List of EventMeta with organizer info

#### BDEventOpp Generation
**POST** `/api/events/opp/generate`
- Body: `{ personaId, priorities: { travel, cost, networking, learning, ecosystem }, companyHQId, ownerId }`
- Process: Pull EventMeta candidates → GPT scorer → Create `BDEventOpp`
- Returns: BDEventOpp records with scores

### Services

**File**: `src/lib/services/ecosystemOrgInference.ts`
- `runEcosystemOrgInference()` - AI-powered org intelligence inference

**File**: `src/lib/services/organizerMatcher.ts`
- `findOrCreateOrganizer()` - Fuzzy match organizer names to EcosystemOrg records

### Key Features

1. **Organizer Intelligence**: EcosystemOrg provides BD intelligence (relevance scores, industry tags, persona alignment) that flows through to events
2. **Global Event Catalog**: EventMeta is a single source of truth - once created, referenced by all BDEventOpps
3. **Persona-Driven Scoring**: BDEventOpp scoring uses persona + priorities + ecosystem intelligence
4. **Fuzzy Matching**: Automatic organizer matching prevents duplicates and links events to orgs

---

## Events Architecture

### Overview

The Events system provides a complete pipeline from event discovery to BD opportunity analysis to strategic planning. Events are generated via AI recommendations, cataloged in EventMeta, scored as BDEventOpp, and organized into EventPlans.

### Event Models Hierarchy

```
EventMeta (Global Catalog)
  ↓
BDEventOpp (BD Analysis) ──→ EventPlan (Strategy)
```

### Event Generation Flow

1. **Discovery**: Persona-based event recommendations via GPT
2. **Cataloging**: Events saved to EventMeta with organizer linkage
3. **Analysis**: BDEventOpp scoring for specific persona/company context
4. **Planning**: EventPlan organizes selected opportunities

### Event Types

- **ASSOCIATION**: Events produced by professional associations
- **COMMERCIAL**: Commercial event producers
- **MEDIA**: Media company events
- **INDUSTRY**: Industry-specific events
- **PRIVATE**: Private/closed events
- **CORPORATE**: Corporate-hosted events

### BD Scoring System

BDEventOpp uses a 5-dimensional scoring system:
- `personaAlignment` (0-100): Overall fit with target persona
- `travelBurden` (1-10): Travel cost/complexity (lower = better)
- `costFit` (1-10): Cost-effectiveness (higher = better)
- `ecosystemFit` (0-100): Derived from organizer's BD relevance score
- `bdOpportunity` (0-100): Composite score weighted by user priorities

### API Routes

**POST** `/api/events/meta/ingest` - Create EventMeta records
**GET** `/api/events/meta` - List events
**POST** `/api/events/opp/generate` - Generate BDEventOpp from EventMeta
**POST** `/api/events/save` - Save event (legacy, will migrate to EventMeta)

### UI Pages

- `/events` - Events hub
- `/events/build-from-persona` - Persona-based event recommendations

---

## Personas Architecture

### Overview

**Personas** are CompanyHQ-scoped templates representing ideal customer archetypes. They are NOT individual contacts - they are reusable profiles that many contacts can match to.

**Purpose**: 
- Match contacts to personas automatically
- Score product fit using persona data
- Guide BD Intelligence with rich context
- Link products to personas for targeted recommendations
- Drive event recommendations and ecosystem intelligence

### Persona Model

**File**: `prisma/schema.prisma`

```prisma
model Persona {
  id              String      @id @default(cuid())
  companyHQId     String      // Required - tenant scoping
  personName      String      @default("")
  title           String
  headline        String?
  seniority       String?
  industry        String?
  subIndustries   String[]
  description     String?
  whatTheyWant    String?
  painPoints      String[]
  risks           String[]
  decisionDrivers String[]
  buyerTriggers   String[]
  
  // Relations
  companyHQ       CompanyHQ   @relation(...)
  productFit      ProductFit?
  bdIntel         BdIntel?
  bdosScores      BDOSScore[]
}
```

**Key Fields**:
- `personName`: Persona name (e.g., "Solo Biz Owner")
- `title`: Role/Title (e.g., "Sole Proprietor")
- `whatTheyWant`: Goals and desires
- `painPoints`: Array of pain points
- `buyerTriggers`: What triggers them to buy

### Persona Generation

**Three Generation Methods**:

1. **From Enriched Contact** (Apollo):
   - `POST /api/personas/generate`
   - Uses Apollo enrichment data from Redis
   - Generates persona fields via GPT-4o

2. **From Description**:
   - `POST /api/personas/generate-from-description`
   - Free-form text description → GPT → Persona

3. **Unified Generation** (Recommended):
   - `POST /api/personas/generate-unified`
   - Generates Persona + ProductFit + BdIntel in one call

### Persona Intelligence

**Product Fit**: `ProductFit` model links personas to products
- `valuePropToThem`: How product solves persona's problems
- `alignmentReasoning`: Why this persona fits this product

**BD Intelligence**: `BdIntel` model provides BD insights
- `fitScore`: Overall fit (0-100)
- `painAlignmentScore`: Pain point alignment (0-100)
- `recommendedTalkTrack`: Recommended messaging
- `recommendedSequence`: Outreach sequence

### Persona Usage

**Event Recommendations**:
- Personas drive event recommendation generation
- Events scored based on persona attributes (industry, role, goals)

**Contact Matching**:
- Automatic persona matching for contacts
- Uses role, industry, and semantic similarity

**Product Targeting**:
- Products can target specific personas
- Enables persona-based product recommendations

### API Routes

**GET** `/api/personas` - List personas for companyHQ
**POST** `/api/personas` - Create persona
**GET** `/api/personas/[personaId]` - Get persona detail
**POST** `/api/personas/generate` - Generate from enriched contact
**POST** `/api/personas/generate-from-description` - Generate from text
**POST** `/api/personas/[personaId]/product-fit` - Generate product fit
**POST** `/api/personas/[personaId]/bd-intel` - Generate BD intelligence

### UI Pages

- `/personas` - Personas list
- `/personas/builder` - Persona builder
- `/personas/[personaId]` - Persona detail view
- `/personas/build-from-contacts` - Generate personas from contacts

**Documentation**: See `docs/personas-parser/PERSONA_ARCHITECTURE.md` for complete reference.

---

## Design System & UX Patterns

### Typography

**Fonts:**
- Sans: `Geist` (Google Font)
- Mono: `Geist_Mono` (Google Font)
- Applied via CSS variables: `--font-geist-sans`, `--font-geist-mono`

**Setup in Root Layout:**
```javascript
// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});
```

**Hierarchy:**
- H1: `text-3xl` or `text-4xl font-bold`
- Body: Base size with `antialiased`

### Color Palette

**Primary Brand:**
- Red gradient: `bg-gradient-to-br from-red-600 via-red-700 to-red-800`
- Accent gradient: `bg-gradient-to-r from-red-600 to-orange-600`
- Primary button: `bg-red-600 hover:bg-red-700`

**UI Elements:**
- Glass-morphism: `bg-white/10 backdrop-blur-sm`
- Borders: `border-white/20` or `border-white/30`
- Text on dark: `text-white`, `text-white/80`, `text-white/60`
- White cards: `bg-white rounded-xl shadow-xl`

### Component Patterns

#### Buttons

**Primary Button:**
```jsx
className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition"
```

**Gradient Button:**
```jsx
className="bg-gradient-to-r from-red-600 to-orange-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-red-700 hover:to-orange-700 transition shadow-lg"
```

**Glass Button:**
```jsx
className="bg-white/20 border-2 border-white/30 text-white py-4 px-6 rounded-xl font-semibold hover:bg-white/30 transition shadow-lg"
```

#### Cards

**Glass-morphism Card (Auth Pages):**
```jsx
className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20"
```

**White Card (Authenticated App):**
```jsx
className="bg-white rounded-xl shadow-xl p-8"
```

#### Loading States

**Spinner:**
```jsx
<div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4" />
<p className="text-white text-xl">Loading your account...</p>
```

**Full Page Loading (Red Gradient Background):**
```jsx
<div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
  <div className="text-center">
    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4" />
    <p className="text-white text-xl">Loading...</p>
  </div>
</div>
```

#### Form Inputs

**Glass Input (Auth Pages):**
```jsx
className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500"
```

#### Error States

**Error Card:**
```jsx
<div className="bg-white rounded-xl shadow-xl p-8">
  <p className="text-red-600 text-lg mb-4">{error}</p>
  <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium">
    Reload Page
  </button>
</div>
```

### Layout Patterns

#### Authenticated Layout
**Pattern:** Provider wrapper with AppShell

```javascript
// app/layout.js
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

// app/providers.jsx
export default function Providers({ children }) {
  return (
    <ActivationProvider>
      <AppShell>{children}</AppShell>
    </ActivationProvider>
  );
}
```

#### Route Group Layouts
**Pattern:** Each route group can have its own layout

- `(public)/` - No layout (full-page auth screens)
- `(onboarding)/` - No additional layout (full-page flows)
- `(authenticated)/` - AppShell with sidebar navigation

### Spacing & Animations

**Spacing:**
- Consistent Tailwind spacing scale
- Section padding: `p-4`, `p-8`
- Gaps: `gap-3`, `gap-4`, `space-y-4`, `space-y-8`

**Animations:**
- Spin: `animate-spin` for loading spinners
- Transitions: `transition`, `transition-colors`
- Hover states on all interactive elements

### Key UX Patterns to Copy to CRM

#### 1. **Splash Screen Pattern**
- Initial branding page with 2-second delay
- Firebase auth state detection
- Auto-redirect based on auth status

#### 2. **Glass-morphism Auth Pages**
- Red gradient backgrounds
- Glass-morphism cards for forms
- Tab switchers for auth methods
- Styled inputs with white/transparent backgrounds

#### 3. **Loading States**
- Animated spinners on red gradient backgrounds
- Clear messaging ("Loading your account...")
- Consistent loading state patterns

#### 4. **Error States**
- White cards with error messages
- Action buttons to retry/reload
- User-friendly error messaging

#### 5. **Welcome Flow**
- Personalized greetings using owner data
- Context-aware messaging (company name, etc.)
- Clear CTA buttons to continue

#### 6. **Route Group Organization**
```
app/
├── (public)/          # Splash, signin, signup
├── (onboarding)/      # Welcome, company setup
└── (authenticated)/   # Main app features
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
- **`docs/personas-parser/PERSONA_ARCHITECTURE.md`** - Complete persona model and API reference
- **`docs/ECOSYSTEM_FORENSIC_AUDIT.md`** - Ecosystem/events forensic scan findings
- **`docs/ECOSYSTEM_REFACTOR_COMPLETE.md`** - Ecosystem intelligence refactor summary

---

## Current Status

**✅ Completed:**
- Next.js App Router structure
- Route groups (public, onboarding, authenticated)
- API routes for Owner, Contacts, Company
- Hydration flows (Welcome, Contacts, Outreach, Pipelines)
- Feature-level layouts with context
- Dynamic routes ([contactId], [personaId], [proposalId])
- **Ecosystem Intelligence**: EcosystemOrg → EventMeta → BDEventOpp → EventPlan architecture
- **Events System**: Complete event catalog and BD opportunity analysis
- **Personas System**: Persona generation, matching, and intelligence scoring

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

