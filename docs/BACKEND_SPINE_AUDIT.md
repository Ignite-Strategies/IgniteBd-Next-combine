# Backend Spine & Model Audit

**Last Updated**: January 2025  
**Purpose**: Complete mapping of database models, API routes, services, and backend architecture

---

## 📊 Database Schema (Models)

### Location
- **File**: `prisma/schema.prisma`
- **Migrations**: `prisma/migrations/`
- **Client**: `lib/prisma.js` (Prisma Client instance)

### Core Models

#### User & Authentication
```prisma
model owners {
  id                        String  @id
  firebaseId                String  @unique
  email                     String?
  firstName                 String?
  lastName                  String?
  
  // Microsoft OAuth Integration
  microsoftAccessToken      String?
  microsoftRefreshToken     String?
  microsoftExpiresAt        DateTime?
  microsoftEmail            String?
  microsoftDisplayName      String?
  microsoftTenantId         String?  // Tenant ID for token refresh
  
  // SendGrid Integration
  sendgridVerifiedEmail     String?  // Verified sender email
  sendgridVerifiedName      String?  // Display name for sender
  
  // Relations
  company_hqs[]             // Owned/managed company HQs
  email_activities[]         // Email tracking
  campaigns[]                // Outreach campaigns
  email_sequences[]          // Email sequences
  google_oauth_tokens[]      // Google OAuth tokens
}
```

#### Company & Tenant Management
```prisma
model company_hqs {
  id                String  @id
  companyName       String
  ownerId           String?  // Primary owner
  managerId          String?  // Manager
  contactOwnerId    String?  // Contact who became owner
  
  // Relations
  owners[]          // Owners/managers
  contacts[]        // All contacts in this HQ
  companies[]        // Prospect companies
  campaigns[]        // Campaigns
}
```

#### Contacts & CRM
```prisma
model Contact {
  id                String  @id @default(uuid())
  crmId             String  // company_hq_id (tenant scoping)
  firstName         String?
  lastName          String?
  email             String?
  goesBy            String?
  domain            String?  // Inferred from email
  
  // Relations
  companyHQ         CompanyHQ
  contactCompany    Company?
  contactList       ContactList?
  email_activities[]
}
```

#### Outreach & Email
```prisma
model email_activities {
  id              String  @id
  owner_id        String
  contact_id      String?
  campaign_id     String?
  sequence_id     String?
  email           String
  subject         String
  body            String
  event           String?  // sent, delivered, opened, clicked, etc.
  messageId       String  @unique
  
  // Relations
  owners          owners
  campaigns       campaigns?
  email_sequences email_sequences?
  email_events[]  // Event history
}

model campaigns {
  id              String  @id
  owner_id        String
  company_hq_id   String?
  name            String
  status          CampaignStatus  // DRAFT, ACTIVE, PAUSED, etc.
  type            CampaignType    // EMAIL, SEQUENCE, ONE_OFF
  
  // Relations
  owners          owners
  company_hqs     company_hqs?
  email_activities[]
  email_sequences[]
}
```

#### Personas & Products
```prisma
model personas {
  id              String  @id
  company_hq_id   String
  name            String
  description     String?
  
  // Relations
  company_hqs     company_hqs
  bd_intels       bd_intels?
}

model products {
  id              String  @id
  company_hq_id   String
  name            String
  description     String?
  
  // Relations
  company_hqs     company_hqs
}
```

---

## 🛣️ API Routes Structure

### Location
- **Base Path**: `app/api/`
- **Pattern**: Next.js App Router API routes
- **Format**: `app/api/{resource}/route.js` or `app/api/{resource}/[id]/route.js`

### Route Categories

#### 1. Authentication & User Management
```
/api/owner/
  ├── create/route.js              # POST - Create owner
  ├── hydrate/route.js             # GET - Hydrate owner with company HQs
  └── [ownerId]/profile/route.js  # GET/PUT - Owner profile

/api/auth/
  └── microsoft/
      ├── login/route.js           # GET - Initiate Microsoft OAuth
      └── callback/route.js        # GET - Handle OAuth callback

/api/activate/route.js             # POST - Activate account
/api/set-password/route.js         # POST - Set password
```

#### 2. Contacts & CRM
```
/api/contacts/
  ├── route.js                     # GET - List contacts, POST - Create/update
  ├── retrieve/route.js            # GET - Retrieve contacts (with filters)
  ├── create/route.js              # POST - Create contact
  ├── hydrate/route.js             # POST - Hydrate contacts
  ├── batch/route.js                # POST - Batch import
  ├── by-email/route.js             # GET - Find by email
  ├── by-firebase-uid/route.js      # GET - Find by Firebase UID
  ├── cleanup-duplicates/route.js   # POST - Remove duplicates
  ├── [contactId]/
  │   ├── route.js                 # GET/PUT/DELETE - Single contact
  │   ├── pipeline/route.js         # GET/PUT - Pipeline stage
  │   └── generate-portal-access/  # POST - Generate portal access
  └── enrich/
      ├── route.ts                  # POST - Enrich contact
      ├── save/route.ts             # POST - Save enriched data
      ├── preview/route.ts          # GET - Preview enrichment
      └── intelligence/route.ts     # GET - Get intelligence
```

#### 3. Outreach & Email
```
/api/outreach/
  ├── send/route.js                 # POST - Send 1-to-1 email
  ├── recent/route.js               # GET - Recent email sends
  └── verified-senders/route.js     # GET/PUT - Get/set verified sender

/api/email/
  ├── send/route.js                 # POST - Send email via SendGrid
  └── config/route.js                # GET - SendGrid config status

/api/webhooks/
  └── sendgrid/route.js             # POST - SendGrid webhook events

/api/campaigns/
  ├── route.js                       # GET - List campaigns, POST - Create
  └── [campaignId]/route.js         # GET/PUT/DELETE - Single campaign
```

#### 4. Companies & Organizations
```
/api/companies/
  ├── route.js                       # GET - List, POST - Create
  └── [companyId]/route.js          # GET/PUT/DELETE - Single company

/api/company/
  ├── route.js                       # GET/POST - Company operations
  ├── hydrate/route.js              # GET - Hydrate company data
  ├── upsert/route.js                # POST - Upsert company
  └── [companyId]/route.js          # GET/PUT - Single company

/api/companyhq/
  └── get/route.js                   # GET - Get company HQ
```

#### 5. Personas & Products
```
/api/personas/
  ├── route.js                       # GET - List, POST - Create
  ├── generate/route.ts              # POST - Generate persona
  ├── generate-from-description/    # POST - Generate from description
  ├── generate-from-enrichment/     # POST - Generate from enrichment
  ├── generate-unified/route.ts     # POST - Unified generation
  └── [personaId]/
      ├── route.js                   # GET/PUT/DELETE - Single persona
      ├── bd-intel/route.ts          # GET - BD intelligence
      └── product-fit/route.ts       # GET - Product fit score
```

#### 6. Proposals & Work Packages
```
/api/proposals/
  ├── route.js                       # GET - List, POST - Create
  ├── assemble/route.js              # POST - Assemble proposal
  ├── create/
  │   ├── blank/route.js            # POST - Create blank
  │   └── from-csv/route.js         # POST - Create from CSV
  └── [proposalId]/
      ├── route.js                   # GET/PUT/DELETE - Single proposal
      ├── deliverables/route.js      # GET/POST - Deliverables
      ├── approve/route.js           # POST - Approve proposal
      └── preview/route.js           # GET - Preview proposal

/api/workpackages/
  ├── route.js                       # GET - List, POST - Create
  ├── [id]/route.js                  # GET/PUT/DELETE - Single work package
  ├── bulk-upload/route.js           # POST - Bulk upload
  ├── import/
  │   ├── one-shot/route.js          # POST - One-shot import
  │   ├── proposal/route.js          # POST - Import from proposal
  │   └── mapped/route.js            # POST - Mapped import
  └── items/route.js                 # GET/POST - Work items
```

#### 7. Templates & Content
```
/api/template/
  ├── build/route.js                 # POST - Build template
  ├── generate/route.js              # POST - Generate template
  ├── generate-with-variables/       # POST - Generate with variables
  ├── hydrate/route.js               # POST - Hydrate template
  ├── hydrate-with-contact/          # POST - Hydrate with contact
  ├── parse/route.js                 # POST - Parse template
  ├── save/route.js                  # POST - Save template
  └── saved/route.js                 # GET - Get saved templates

/api/content/
  ├── blog/
  │   ├── route.js                   # GET - List, POST - Create
  │   ├── [id]/route.js              # GET/PUT/DELETE - Single blog
  │   ├── draft/route.js              # GET/POST - Draft blog
  │   └── store-draft/route.js       # POST - Store draft
  └── presentations/
      ├── route.js                   # GET - List, POST - Create
      ├── [id]/route.js              # GET/PUT/DELETE - Single presentation
      └── generate-outline/           # POST - Generate outline
```

#### 8. Integrations
```
/api/microsoft/
  ├── login/route.js                 # GET - Initiate OAuth
  ├── callback/route.js              # GET - OAuth callback
  ├── disconnect/route.js            # DELETE - Disconnect account
  ├── status/route.js                # GET - Connection status
  ├── send-mail/route.js             # POST - Send email via Microsoft
  └── contacts/
      └── preview/route.js           # GET - Preview contacts

/api/integrations/
  └── google/
      ├── connect/route.ts           # POST - Connect Google
      └── callback/route.ts          # GET - OAuth callback
```

#### 9. Admin Routes
```
/api/admin/
  ├── billing/
  │   ├── route.js                   # GET - List invoices
  │   ├── [invoiceId]/route.js       # GET/PUT - Single invoice
  │   └── template/route.js          # GET - Invoice template
  ├── companyhq/
  │   └── create/route.js            # POST - Create company HQ
  └── companyhqs/route.js            # GET - List all company HQs

/api/superadmin/
  └── create/route.js                # POST - Create super admin
```

---

## 🔧 Service Layer

### Location
- **Base Path**: `lib/services/`
- **Purpose**: Business logic, data transformation, external API calls

### Service Categories

#### Contact & CRM Services
```
lib/services/
  ├── contactService.ts              # Contact CRUD operations
  ├── contactsRegistry.js           # Contact registry management
  ├── contactFieldMapper.js         # Field mapping logic
  └── CompanyEnrichmentService.js   # Company enrichment
```

#### Outreach & Email Services
```
lib/services/
  └── outreachSendService.js        # SendGrid email sending
    - sendOutreachEmail()            # Main send function
    - Uses owner's verified email
    - Tracks campaigns/sequences
```

#### Persona & Intelligence Services
```
lib/services/
  ├── PersonaGenerationService.js    # Generate personas
  ├── EnrichmentToPersonaService.ts  # Convert enrichment to persona
  ├── BusinessIntelligenceScoringService.js  # Scoring logic
  └── BDEventOppSaveService.ts      # Save BD event opportunities
```

#### Proposal & Work Package Services
```
lib/services/
  ├── ProposalTimelineService.js    # Proposal timeline calculation
  ├── ProposalToDeliverablesService.js  # Convert proposal to deliverables
  ├── WorkPackageHydrationService.js  # Hydrate work packages
  ├── workPackageCsvMapper.js       # CSV mapping
  ├── workPackageCsvHydration.js    # CSV hydration
  └── TimelineEngine.js             # Timeline calculations
```

#### Event & Ecosystem Services
```
lib/services/
  ├── EventRecommendationService.ts  # Event recommendations
  ├── EventUpsertService.ts         # Upsert events
  ├── EventPlannerService.ts        # Event planning
  ├── ecosystemOrgInference.ts      # Ecosystem org inference
  └── associationInference.ts       # Association inference
```

#### Content Generation Services
```
lib/services/
  ├── PresentationGenerationService.js  # Generate presentations
  ├── googleDocAssemblyService.ts   # Google Doc assembly
  └── AssessmentCalculationService.js  # Assessment calculations
```

---

## 🔌 Integration Clients

### Location
- **Base Path**: `lib/`

### External Service Clients

#### SendGrid
```
lib/sendgridClient.js
  - sendEmail()                     # Send single email
  - sendBatchEmails()               # Send batch emails
  - Uses SENDGRID_API_KEY env var
```

#### Microsoft Graph
```
lib/microsoftGraphClient.js
  - getValidAccessToken()           # Get/refresh access token
  - refreshAccessToken()            # Refresh expired token
  - Uses owner.microsoftTenantId for tenant-specific refresh

lib/microsoftGraph.js
  - MSAL initialization
  - Graph API client setup

lib/microsoftOAuthGuardrails.js
  - OAuth configuration validation
  - Prevents common misconfigurations
```

#### Google Services
```
lib/googleOAuth.ts                  # Google OAuth client
lib/googleServiceAccount.js         # Service account auth
```

#### Apollo (Enrichment)
```
lib/apollo.ts                        # Apollo API client
```

---

## 🗄️ Database Access Pattern

### Prisma Client
```javascript
// lib/prisma.js
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

### Common Query Patterns

#### Get Owner with Relations
```javascript
const owner = await prisma.owners.findUnique({
  where: { firebaseId: firebaseUser.uid },
  include: {
    company_hqs: true,
  },
});
```

#### Get Contacts with Company
```javascript
const contacts = await prisma.contact.findMany({
  where: { crmId: companyHQId },
  include: {
    contactCompany: true,
    companyHQ: true,
  },
});
```

#### Get Email Activities
```javascript
const activities = await prisma.email_activities.findMany({
  where: { owner_id: ownerId },
  include: {
    owners: true,
    campaigns: true,
  },
});
```

---

## 🔐 Authentication & Authorization

### Firebase Authentication
```
lib/firebaseAdmin.js
  - verifyFirebaseToken()            # Verify Firebase token
  - Used in all API routes

lib/firebaseClient.js
  - Client-side Firebase setup

lib/firebase.js
  - Firebase initialization
```

### Membership Guards
```
lib/membership.js
  - resolveMembership()              # Check user membership
  - Used to protect company HQ scoped routes
```

### Admin Guards
```
lib/adminGuard.js
  - Admin access checks
```

---

## 📦 Key Utilities

### API Client
```
lib/api.js
  - Axios instance with Firebase token interceptor
  - Base URL configuration
  - Handles relative URLs (Next.js API routes)
```

### Tenant Management
```
lib/tenant.js                        # Tenant utilities
lib/tenantSwitch.js                  # Tenant switching
lib/companyhq-switcher.js            # Company HQ switching
```

### Parsers & Mappers
```
lib/parsers/
  ├── parserConfigs.ts              # Parser configurations
  ├── typePrompts.ts                 # Type prompts
  └── configs/
      ├── blog.ts
      ├── ecosystem.ts
      ├── events.ts
      └── product.ts
```

---

## 🔄 Data Flow Patterns

### 1. Contact Creation Flow
```
Frontend → /api/contacts/create
  → verifyFirebaseToken()
  → resolveMembership() (check company HQ access)
  → contactService.createContact()
  → prisma.contact.create()
  → Return contact
```

### 2. Email Sending Flow
```
Frontend → /api/outreach/send
  → verifyFirebaseToken()
  → Get owner (with verified email)
  → outreachSendService.sendOutreachEmail()
  → SendGrid API
  → prisma.email_activities.create()
  → Return success
```

### 3. Microsoft OAuth Flow
```
Frontend → /api/microsoft/login
  → Redirect to Microsoft
  → Microsoft → /api/microsoft/callback
  → Exchange code for tokens
  → Extract tenant ID from ID token
  → prisma.owners.update() (store tokens + tenant ID)
  → Redirect to settings
```

---

## 📝 Model Relationships Summary

### Core Relationships
- **owners** → **company_hqs** (one-to-many: owner can own/manage multiple HQs)
- **company_hqs** → **contacts** (one-to-many: each contact belongs to one HQ)
- **owners** → **email_activities** (one-to-many: owner sends many emails)
- **campaigns** → **email_activities** (one-to-many: campaign has many email sends)
- **company_hqs** → **personas** (one-to-many: HQ has many personas)
- **company_hqs** → **products** (one-to-many: HQ has many products)

### Tenant Scoping
- Most models are scoped by `company_hq_id` (tenant isolation)
- Contacts use `crmId` field (maps to `company_hq_id`)
- Membership guards ensure users can only access their company HQ's data

---

## 🚀 Quick Reference

### Where to Find Things

| What | Where |
|------|-------|
| Database Schema | `prisma/schema.prisma` |
| API Routes | `app/api/{resource}/route.js` |
| Services | `lib/services/{ServiceName}.js` |
| Integration Clients | `lib/{service}Client.js` |
| Prisma Client | `lib/prisma.js` |
| Firebase Auth | `lib/firebaseAdmin.js` |
| API Client | `lib/api.js` |

### Common Tasks

**Add a new API route:**
1. Create `app/api/{resource}/route.js`
2. Use `verifyFirebaseToken()` for auth
3. Use `resolveMembership()` if company HQ scoped
4. Use Prisma for database access

**Add a new service:**
1. Create `lib/services/{ServiceName}.js`
2. Export service functions
3. Import in API routes

**Add a new model:**
1. Add to `prisma/schema.prisma`
2. Run `npx prisma migrate dev`
3. Update related services/routes

---

## 🔍 Notes

- **Next.js App Router**: All API routes use Next.js App Router pattern
- **Server-Side Only**: API routes run server-side (no 'use client')
- **Firebase Auth**: All routes require Firebase token (except OAuth callbacks)
- **Tenant Isolation**: Most data is scoped by `company_hq_id`
- **Prisma ORM**: All database access goes through Prisma Client

---

**Last Audit**: January 2025  
**Maintained By**: Development Team

