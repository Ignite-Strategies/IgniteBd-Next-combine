# Client Operations - Complete Guide

## Overview

**Client Operations** is about **delivering value** to clients once they enter our architecture. This document covers the complete flow from contact onboarding to client portal access, including owner-side operations, authentication flows, and contact management.

**The Core Reality:**
```
Contact → Contract → Deliverables → Client Portal → Pay Bills
```

**Key Principle:** Contact-First (Universal Personhood)
- Contact exists in IgniteBD (funnel, outreach, etc.)
- Same Contact can access Client Portal
- **No new user record needed** - Contact IS the user
- Contact's email = Firebase login username
- Contact's `firebaseUid` = Portal identity

---

## Table of Contents

1. [Contact to Client Walkthrough](#contact-to-client-walkthrough)
2. [Client Portal Login Flow](#client-portal-login-flow)
3. [Contact Search Architecture](#contact-search-architecture)
4. [Owner-Side Operations](#owner-side-operations)
5. [Execution Hub](#execution-hub)
6. [Data Relationships](#data-relationships)
7. [API Endpoints](#api-endpoints)

---

## Contact to Client Walkthrough

### First Onboarding Meeting Guide

**Goal**: Set up client account, demonstrate persona functionality, walk through deliverables, and establish value proposition.

### Pre-Meeting Checklist: Must-Build Items

#### ✅ Critical Path (Must Have)
1. **Client Account Setup**
   - [ ] CompanyHQ created for client
   - [ ] At least one Contact created
   - [ ] Company linked to Contact via `contactCompanyId`
   - [ ] Product(s) created (if applicable)

2. **Persona Functionality**
   - [ ] Persona creation form working (`/persona` or `/personas/builder`)
   - [ ] Can create persona with:
     - Name, Role, Title, Industry
     - Goals, Pain Points, Desired Outcome
     - Value Prop to Persona
   - [ ] Product alignment working (if product selected)
   - [ ] Alignment score calculation working
   - [ ] Can view/edit existing personas

3. **Basic Deliverables Demo**
   - [ ] At least one ConsultantDeliverable created
   - [ ] Linked to Contact
   - [ ] Status tracking visible

#### 🎯 Nice to Have (If Time Permits)
- [ ] Proposal creation wizard working
- [ ] Client portal access generation
- [ ] Timeline view

### Meeting Flow

#### 1. Account Setup (5-10 min)

**Objective**: Get client's account configured in the system

**Steps**:
1. **Create CompanyHQ** (if not already done)
   - Navigate to company setup
   - Enter:
     - Company Name
     - Industry
     - What You Do (description)
     - Website (optional)
   - Save CompanyHQ ID for reference

2. **Create Contact** (the client person)
   - Go to Contacts
   - Add contact with:
     - First Name, Last Name
     - Email (critical - used for portal access)
     - Phone (optional)
     - Title/Role
   - Link to Company via `contactCompanyId`

3. **Create Product** (if applicable)
   - Go to Products
   - Create product with:
     - Name
     - Value Prop (this is what aligns with personas)
   - Link to CompanyHQ

**Demo Points**:
- "This is your tenant account - everything is scoped to your CompanyHQ"
- "Contacts are universal - same person can be in outreach AND client portal"
- "Products help us align personas with your value proposition"

#### 2. Persona Walkthrough (15-20 min) ⭐ **CORE DEMO**

**Objective**: Show how personas work and demonstrate value prop alignment

**Starting Point**: Navigate to `/persona` or `/personas/builder`

**Live Demo Flow**:

1. **Create a Persona Together**
   - "Let's build a persona for your ideal client"
   - Fill out form together:
     - **Persona Name**: e.g., "Solo Biz Owner"
     - **Role**: e.g., "Founder"
     - **Title**: e.g., "Principal Consultant"
     - **Industry**: e.g., "Professional Services"
   
2. **Capture Their Insights**
   - **Goals**: "What outcomes do they care about?"
     - Example: "Grow revenue without working more hours"
   - **Pain Points**: "Where are they feeling friction?"
     - Example: "Manual follow-up, inconsistent pipeline visibility"
   - **Desired Outcome**: "What do they want?"
     - Example: "Automate client follow-up so nothing slips"

3. **Value Prop Alignment** ⭐ **KEY MOMENT**
   - **Value Prop to Persona**: "How does your solution help them?"
     - Example: "Simplify client management without hiring an assistant"
   - **Select Product** (if product exists)
   - **Show Alignment Score**: "See how well your product aligns with this persona"
     - Score calculated automatically (0-100)
     - Higher score = better fit

4. **Save & Review**
   - Save persona
   - Show persona details
   - Explain: "This persona now informs all your outreach and messaging"

**Demo Points**:
- "Personas help you speak directly to your ideal client"
- "Alignment score shows product-market fit"
- "Use personas to craft targeted messaging"
- "Personas drive your outreach strategy"

**Value Prop Pitch**:
- "We help you understand WHO you're selling to"
- "Alignment scores show you which personas are best fits"
- "Personas become the foundation for all your messaging"

#### 3. Deliverables Overview (10-15 min)

**Objective**: Show what you're delivering to the client

**Starting Point**: Navigate to Client Operations or Proposals

**Demo Flow**:

1. **Show Deliverables Concept**
   - "Deliverables are what we're providing to clients"
   - Show ConsultantDeliverable model:
     - Title (e.g., "3 Target Personas")
     - Description
     - Category (foundation, integration, enrichment)
     - Status (pending, in-progress, completed)
     - Linked to Contact

2. **Create Sample Deliverable** (if time)
   - Create deliverable linked to their Contact
   - Set status to "in-progress"
   - Show how it tracks progress

3. **Connect to Proposals** (if applicable)
   - Show how deliverables link to proposals
   - Show how proposals have phases/milestones
   - Show how deliverables map to milestones

**Demo Points**:
- "Deliverables = what we're actually providing"
- "Status tracking = real-time visibility"
- "Everything links back to the Contact (the person)"

#### 4. Value Proposition Summary (5 min)

**Closing Pitch**:

**What We Do**:
1. **Persona Development**: Understand your ideal client deeply
2. **Alignment Scoring**: Measure product-market fit
3. **Deliverable Tracking**: Clear visibility into what we're providing
4. **Contact-First Operations**: One person, multiple contexts (outreach + client portal)

**Why It Matters**:
- **Better Messaging**: Personas inform all outreach
- **Better Fit**: Alignment scores show best opportunities
- **Better Operations**: Clear deliverables and status tracking
- **Better Experience**: Clients see everything in portal

**Next Steps**:
- "We'll build out 2-3 personas together"
- "We'll create deliverables based on your engagement"
- "You'll see everything in your client portal"

### Technical Notes for Demo

#### Routes to Know
- `/persona` - Simple persona creation form
- `/personas/builder` - Advanced persona builder with templates
- `/personas` - List all personas
- `/client-operations/proposals` - Proposal management
- `/client-operations/proposals/wizard` - Create new proposal
- `/contacts` - Contact management

#### Key API Endpoints
- `POST /api/personas` - Create/update persona
- `GET /api/personas` - List personas (filtered by companyHQId)
- `POST /api/contacts` - Create contact
- `POST /api/companies` - Upsert company
- `POST /api/proposals` - Create proposal

#### Data Flow
```
CompanyHQ (Tenant)
  └── Contact (Person)
        ├── Persona[] (Ideal clients)
        ├── Company (via contactCompanyId)
        │     └── Proposal[]
        │           └── ConsultantDeliverable[]
        └── Firebase Account (for portal)
```

#### Common Issues & Solutions

**Issue**: "Can't find CompanyHQ ID"
- **Solution**: Check localStorage for `companyHQId` or use `NEXT_PUBLIC_DEFAULT_COMPANY_HQ_ID`

**Issue**: "Persona alignment score not calculating"
- **Solution**: Ensure both `product.valueProp` and `persona.valuePropToPersona` are filled

**Issue**: "Contact not linking to Company"
- **Solution**: Set `contactCompanyId` when creating/updating contact

**Issue**: "Can't see personas"
- **Solution**: Ensure filtering by `companyHQId` - personas are tenant-scoped

### Post-Meeting Action Items

#### Immediate (Same Day)
- [ ] Create 2-3 personas based on meeting discussion
- [ ] Set up initial deliverables
- [ ] Create first proposal (if engagement agreed)

#### Short Term (This Week)
- [ ] Generate client portal access
- [ ] Set up proposal with phases/milestones
- [ ] Link deliverables to proposal milestones

#### Follow-Up
- [ ] Schedule next check-in
- [ ] Share persona documents
- [ ] Review alignment scores together

### Success Metrics

**Meeting Success =**:
- ✅ Client account created
- ✅ At least 1 persona created together
- ✅ Client understands value prop
- ✅ Deliverables concept explained
- ✅ Next steps clear

**Post-Meeting Success =**:
- ✅ 2-3 personas documented
- ✅ Initial deliverables created
- ✅ Proposal created (if applicable)
- ✅ Client portal access generated

---

## Client Portal Login Flow

### Architecture Alignment

This flow follows **FIREBASE-AUTH-AND-USER-MANAGEMENT.md** Pattern B (Hydrate Route).

### Step-by-Step Login Flow

#### 1. User Enters Email/Password (Frontend)
**File:** `ignitebd-clientportal/app/login/page.jsx`

```javascript
// User submits form with email and password
credentials = {
  username: "joel@businesspointlaw.com",
  password: "user-password"
}
```

#### 2. Firebase Authentication (Frontend)
**File:** `ignitebd-clientportal/app/login/page.jsx`

```javascript
// Step 1: Authenticate with Firebase
const result = await signInWithEmailAndPassword(
  auth,
  credentials.username, // Email
  credentials.password
);

// Result contains:
// - result.user.uid (Firebase UID - UNIVERSAL IDENTIFIER)
// - result.user.email
// - result.user.displayName
```

**✅ Firebase establishes universal identity**
- Firebase UID = Universal Person Identifier
- One Firebase UID = One Contact across all systems

#### 3. Get Firebase Token (Frontend)
**File:** `ignitebd-clientportal/app/login/page.jsx`

```javascript
// Step 2: Get Firebase token for API calls
const idToken = await result.user.getIdToken();
// Token is automatically managed by Firebase SDK
// No manual storage needed - axios interceptor handles it
```

#### 4. Find Contact by Firebase UID (Backend API)
**File:** `IgniteBd-Next-combine/src/app/api/contacts/by-firebase-uid/route.js`

**Request:**
```javascript
// Axios interceptor automatically adds token:
// Authorization: Bearer <firebase-token>

GET /api/contacts/by-firebase-uid
Headers: {
  Authorization: "Bearer <firebase-token>"
}
```

**Backend Process:**
1. `verifyFirebaseToken(request)` extracts Firebase UID from token
2. `prisma.contact.findUnique({ where: { firebaseUid } })`
3. Returns contact data

**Response:**
```json
{
  "success": true,
  "contact": {
    "id": "contact-id",
    "firebaseUid": "firebase-uid",
    "email": "joel@businesspointlaw.com",
    "firstName": "Joel",
    "lastName": "Gulick",
    "crmId": "company-hq-id",
    "role": "contact",
    "isActivated": true
  }
}
```

#### 5. Store Session (Frontend)
**File:** `ignitebd-clientportal/app/login/page.jsx`

```javascript
// Store contact session data
localStorage.setItem('clientPortalContactId', contact.id);
localStorage.setItem('clientPortalCompanyHQId', contact.crmId);
localStorage.setItem('clientPortalContactEmail', contact.email);
localStorage.setItem('firebaseId', firebaseUid);

// Firebase token is NOT stored manually
// Axios interceptor gets fresh token on each request via Firebase SDK
```

#### 6. Redirect to Dashboard
```javascript
router.push('/welcome');
```

### Key Architecture Points

#### ✅ What We're Doing Right

1. **Firebase UID is Universal Identifier**
   - Not email lookup
   - Not contact ID lookup
   - Firebase UID connects Contact across all systems

2. **Pattern B: Hydrate Route**
   - `/api/contacts/by-firebase-uid` = Hydrate route
   - Uses `verifyFirebaseToken` middleware
   - Gets Firebase UID from verified token (not from body)

3. **Axios Interceptor Pattern**
   - Uses Firebase SDK's `getIdToken()` (automatic refresh)
   - No manual token storage
   - Tokens persist via Firebase SDK internally

#### ❌ What Was Wrong Before

1. **Email Lookup Instead of Firebase UID**
   ```javascript
   // OLD (WRONG):
   api.get(`/api/contacts/by-email?email=${email}`)
   
   // NEW (CORRECT):
   api.get(`/api/contacts/by-firebase-uid`) // Token in header
   ```

2. **Manual Token Storage**
   ```javascript
   // OLD (WRONG):
   localStorage.setItem('firebaseToken', idToken);
   
   // NEW (CORRECT):
   // No manual storage - Firebase SDK + axios interceptor handles it
   ```

### Database Schema

**Contact Model:**
```prisma
model Contact {
  id          String  @id @default(cuid())
  firebaseUid String? @unique // Firebase Auth UID - UNIVERSAL IDENTIFIER
  email       String? @unique
  firstName   String?
  lastName    String?
  crmId       String  // CompanyHQId (tenant identifier)
  // ... other fields
}
```

**Key Point:** `firebaseUid` is the lookup field, not `email`.

### Error Handling

#### Contact Not Found
```javascript
// If Firebase auth succeeds but Contact not found:
{
  "success": false,
  "error": "Contact not found"
}

// This means:
// - Firebase user exists
// - But Contact.firebaseUid is not set
// - Contact needs to be linked to Firebase UID
```

#### Firebase Auth Fails
```javascript
// If email/password is wrong:
FirebaseError: auth/wrong-password
// User sees: "Sign-in failed. Please check your credentials."
```

### Flow Diagram

```
User Login
    ↓
[1] Enter email/password
    ↓
[2] Firebase signInWithEmailAndPassword()
    ↓
[3] Get Firebase UID (result.user.uid)
    ↓
[4] Get Firebase Token (result.user.getIdToken())
    ↓
[5] Axios interceptor adds token to request
    ↓
[6] GET /api/contacts/by-firebase-uid
    ↓
[7] Backend: verifyFirebaseToken() extracts UID
    ↓
[8] Backend: prisma.contact.findUnique({ where: { firebaseUid } })
    ↓
[9] Return Contact data
    ↓
[10] Store session + redirect to dashboard
```

### Testing Checklist

- [ ] User can sign in with email/password
- [ ] Firebase authentication succeeds
- [ ] `/api/contacts/by-firebase-uid` returns contact
- [ ] Contact has `firebaseUid` set in database
- [ ] Axios interceptor adds token automatically
- [ ] Session data stored correctly
- [ ] Redirect to dashboard works

---

## Contact Search Architecture

### Overview

The contact search system provides real-time, inline filtering of contacts as users type. It uses a centralized **ContactsRegistry** service for fast, indexed lookups.

### Basic Search Capability

#### Real-Time Inline Filtering

- **Shows all contacts** with email addresses when search is empty
- **Filters instantly** as user types in the search input
- **Searches across**:
  - Contact name (firstName + lastName)
  - Email address
  - Company name (contactCompany.companyName)

### Search Flow

```
User types in search box
  ↓
onChange event fires
  ↓
searchTerm state updates
  ↓
useMemo recalculates availableContacts
  ↓
ContactsRegistry.searchWithEmail(query) filters contacts
  ↓
UI updates instantly with filtered results
```

### Query Mechanism

#### ContactsRegistry Service

Located at: `src/lib/services/contactsRegistry.js`

**Key Methods:**
- `search(query)` - Searches all contacts by name, email, or company
- `searchWithEmail(query)` - Searches and filters to only contacts with email addresses
- `getWithEmail()` - Returns all contacts that have email addresses
- `getById(contactId)` - Fast lookup by contact ID
- `getByEmail(email)` - Fast lookup by email address
- `getByCompany(companyName)` - Get all contacts for a company

#### Indexed Lookups

The registry maintains three indexes for fast lookups:
- `byId` - Map of contactId → Contact
- `byEmail` - Map of email (lowercase) → Contact
- `byCompany` - Map of companyName (lowercase) → Contact[]

### CompanyHQId Relationship

#### How CompanyHQId is Set

1. **Owner Authentication**
   - User logs in via Firebase
   - System finds Owner record by `firebaseId`
   - Owner has relationship to `CompanyHQ` via `ownedCompanies` or `managedCompanies`

2. **LocalStorage Storage**
   - `companyHQId` is stored in `localStorage` after owner hydration
   - Retrieved via: `localStorage.getItem('companyHQId')` or `localStorage.getItem('companyId')`
   - Used as tenant identifier for all contact queries

3. **Contact Scoping**
   - All contacts are scoped to `companyHQId` (tenant boundary)
   - Contact model has `crmId` field that links to `CompanyHQ.id`
   - API queries filter by: `/api/contacts?companyHQId=${companyHQId}`

#### Owner → CompanyHQ → Contacts Chain

```
Owner (firebaseId)
  ↓
CompanyHQ (ownerId/managerId relationship)
  ↓
Contacts (crmId = companyHQId)
```

### Finding All Contacts in CompanyHQId

#### API Endpoint

**GET** `/api/contacts?companyHQId=${companyHQId}`

**Response:**
```json
{
  "success": true,
  "contacts": [
    {
      "id": "contact-id",
      "crmId": "company-hq-id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "contactCompany": {
        "companyName": "Acme Corp"
      }
    }
  ]
}
```

#### Hydration Flow

1. **Load from Cache** (fast, no API call)
   - Registry loads from `localStorage.getItem('contacts')`
   - Parses JSON and builds indexes
   - Sets `hydrated = true`

2. **Fetch from API** (if cache empty or refresh needed)
   - Calls `/api/contacts?companyHQId=${companyHQId}`
   - Registry hydrates with fetched contacts
   - Saves to `localStorage.setItem('contacts', JSON.stringify(contacts))`
   - Rebuilds indexes for fast lookups

### Inline Typing Filter

#### Implementation

**File:** `src/app/(authenticated)/client-operations/invite-prospect/page.jsx`

```javascript
// Search input with real-time filtering
<input
  type="text"
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  placeholder="Type to search contacts..."
/>

// useMemo recalculates on searchTerm change
const availableContacts = useMemo(() => {
  if (!searchTerm || !searchTerm.trim()) {
    return registry.getWithEmail(); // Show all with email
  }
  return registry.searchWithEmail(searchTerm); // Filter by query
}, [searchTerm, registry]);
```

#### Search Behavior

- **Empty search** → Shows all contacts with email addresses
- **Typing "john"** → Filters to contacts matching "john" in name/email/company
- **Case-insensitive** → All searches are lowercase
- **Instant updates** → No debounce, filters on every keystroke

### Callback Pattern

#### Registry Singleton

The ContactsRegistry uses a singleton pattern:

```javascript
import { getContactsRegistry } from '@/lib/services/contactsRegistry';

const registry = getContactsRegistry();
// Auto-loads from localStorage on first access
```

#### State Management

- **Registry state** - Maintains contacts array and indexes
- **React state** - `searchTerm` triggers re-renders
- **useMemo** - Memoizes filtered results for performance

#### Refresh Callbacks

1. **Refresh from Cache**
   ```javascript
   refreshContacts = () => {
     registry.loadFromCache();
   }
   ```

2. **Fetch from API**
   ```javascript
   fetchContactsFromAPI = async () => {
     const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
     registry.hydrate(response.data.contacts);
     registry.saveToCache();
   }
   ```

### Usage Example

```javascript
import { getContactsRegistry } from '@/lib/services/contactsRegistry';

// Get registry instance (singleton)
const registry = getContactsRegistry();

// Search contacts
const results = registry.searchWithEmail('john');
// Returns: Array of contacts matching "john" that have email addresses

// Get all contacts with email
const allWithEmail = registry.getWithEmail();

// Fast lookup by ID
const contact = registry.getById('contact-id');

// Fast lookup by email
const contact = registry.getByEmail('john@example.com');
```

### Performance

- **Indexed lookups** - O(1) for ID/email lookups
- **Search filtering** - O(n) but optimized with Set deduplication
- **Memoization** - useMemo prevents unnecessary recalculations
- **LocalStorage cache** - Fast initial load, no API call needed

### Data Flow Summary

```
1. Owner logs in → Firebase auth
2. System finds Owner → Gets CompanyHQ relationship
3. companyHQId stored in localStorage
4. ContactsRegistry loads from localStorage (cache)
5. User types in search → Registry filters in real-time
6. If cache empty → Fetch from API → Hydrate registry → Save to cache
```

---

## Owner-Side Operations

### The Owner Flow

#### 1. Create Proposal
```
Owner → Select Contact
  → Create/upsert Company (via contactCompanyId)
  → Create Proposal (linked to companyHQId, companyId)
  → Proposal status: "draft" → "active" → "approved"
```

#### 2. Convert Proposal to Deliverables
```
When Proposal status = "approved":
  → ProposalToDeliverablesService.convertProposalToDeliverables()
  → Extracts deliverables from Proposal.phases/milestones
  → Creates ConsultantDeliverable records
  → Links to contactId, proposalId, companyHQId, contactCompanyId
  → Status starts as "pending"
```

#### 3. Start Work
```
Owner → Select Contact
  → Navigate to deliverable build page (?contactId=xyz)
  → Build work artifact (persona, blog, upload, etc.)
  → Save to ConsultantDeliverable.workContent (JSON)
  → Update status: "pending" → "in-progress"
```

#### 4. Generate Portal Access
```
Owner → Contact Detail Page
  → Click "Generate Portal Access"
  → POST /api/contacts/:contactId/generate-portal-access
  → Creates Firebase account (passwordless)
  → Generates InviteToken (24h expiration)
  → Returns activation link
  → Owner sends link to Contact
```

### Owner-Side Hydration/Upsert Pattern

**All upserts follow this pattern:**
1. **Link to Tenant** - Everything scoped to `companyHQId` (tenant boundary)
2. **Contact-First** - Start with Contact (the person)
3. **Company Association** - Use `contactCompanyId` to link Contact → Company
4. **Create/Update** - Based on contact/companyId associations

**Example: Creating Deliverable**
```javascript
// 1. Get contact (already has companyHQId via crmId)
const contact = await prisma.contact.findUnique({
  where: { id: contactId },
  include: { contactCompany: true }
});

// 2. Extract tenant and company info
const companyHQId = contact.crmId; // Tenant boundary
const contactCompanyId = contact.contactCompanyId; // Contact's company

// 3. Create deliverable (linked to tenant, contact, company)
const deliverable = await prisma.consultantDeliverable.create({
  data: {
    contactId,              // Link to Contact
    companyHQId,            // Tenant boundary
    contactCompanyId,       // Contact's company
    proposalId,             // Optional: link to Proposal
    title: "...",
    status: "pending",
    // ... other fields
  }
});
```

**Example: Converting Proposal to Deliverables**
```javascript
// When proposal is approved:
// ProposalToDeliverablesService.convertProposalToDeliverables(proposalId)

// 1. Get proposal with company/contact
const proposal = await prisma.proposal.findUnique({
  where: { id: proposalId },
  include: {
    company: {
      include: { contacts: { take: 1 } }
    }
  }
});

// 2. Extract deliverables from proposal structure
const deliverables = extractDeliverablesFromProposal(proposal);

// 3. Create ConsultantDeliverable for each
const created = await Promise.all(
  deliverables.map(d => prisma.consultantDeliverable.create({
    data: {
      contactId: proposal.company.contacts[0].id,
      companyHQId: proposal.companyHQId,
      contactCompanyId: proposal.companyId,
      proposalId: proposal.id,
      title: d.title,
      status: 'pending',
      // ... other fields
    }
  }))
);
```

### ConsultantDeliverable Model

**Schema:**
```prisma
model ConsultantDeliverable {
  id          String   @id @default(cuid())
  contactId   String   // Link to Contact (the client)
  contact     Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  
  // What we're delivering
  title       String
  description String?
  category    String?  // "foundation", "integration", "enrichment", etc.
  type        String?  // "persona", "blog", "upload", etc.
  
  // Work content (stored as JSON for flexibility)
  workContent Json?    // Actual work artifact (persona data, blog content, etc.)
  
  // Status tracking
  status      String   @default("pending") // "pending" | "in-progress" | "completed" | "blocked"
  
  // Link to proposal/milestone (optional)
  proposalId  String?
  proposal    Proposal? @relation(fields: [proposalId], references: [id], onDelete: SetNull)
  milestoneId String?  // Reference to milestone in Proposal.milestones JSON
  
  // Delivery tracking
  dueDate     DateTime?
  completedAt DateTime?
  notes       String?
  
  // Tenant scoping
  companyHQId     String   // Always linked to owner's company
  companyHQ       CompanyHQ @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  contactCompanyId String? // Link to contact's company
  
  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([contactId])
  @@index([proposalId])
  @@index([companyHQId])
  @@map("consultant_deliverables")
}
```

**Key Fields:**
- `workContent` (JSON) - Actual work artifact (persona, blog, etc.) - **This indicates work has started**
- `status` - Tracks progress: pending → in-progress → completed
- `companyHQId` - Tenant boundary (owner's company)
- `contactCompanyId` - Contact's company (for scoping)

### Client Portal (What Clients See)

**📖 For detailed client portal development guide, see:** `ignitebd-clientportal/docs/CLIENT_PORTAL_DEV_GUIDE.md`

**Quick Summary:**
- **Separate App**: `ignitebd-clientportal` - standalone Next.js app
- **Shared Database**: Same Prisma schema and PostgreSQL database
- **Data Sources**: Hydrates from Proposals, WorkPackages, and ConsultantDeliverables
- **Strategic Routing**: Welcome page routes based on work state (proposal ready vs work started)
- **Read-Only**: Clients can view but not edit

---

## Execution Hub

### Overview

The Execution Hub is where consultants go **after** a work package has been created. It's the operational center for viewing work packages, tracking progress, and building deliverables.

### Workflow

#### 1. Build the Work Package

First, create a work package:
- Go to **Work Packages** → **Create Work Package**
- Import from CSV, use templates, or build from scratch
- Define phases, items, and timelines

#### 2. View in Execution Hub

Once built, navigate to:
- **Client Operations** → **Execution Hub** (sidebar)
- See all your work packages listed
- Each package shows:
  - Client name
  - Number of phases and items
  - Total estimated hours
  - Cost (if set)

#### 3. Open Execution Dashboard

Click **"View Execution Dashboard"** on any work package to see:

**Work Package Overview**
- Title, description, and metadata
- Item statistics:
  - Total Items
  - Completed Items
  - In Progress
  - Needs Review

**Phase-Level Timeline**
Each phase displays:
- **Timeline Status Badge**:
  - 🟢 **On Track** (green) - More than 3 days until expected end
  - 🟡 **Warning** (yellow) - Within 3 days of expected end
  - 🔴 **Overdue** (red) - Past expected end date
  - ⚪ **Complete** (gray) - Phase is completed
- **Expected End Date** - Calculated from phase start + estimated hours
- **Aggregated Hours** - Sum of all item hours in the phase

**Work Package Items**
Each item shows:
- Label and type
- Status (not_started, in_progress, completed)
- Progress (completed artifacts / total quantity)
- Estimated hours per unit
- **Clickable Navigation** - Items automatically route to their edit pages based on label:
  - `blog_post` → `/owner/work/edit/blog/[id]`
  - `research` → `/owner/work/edit/research/[id]`
  - `deliverable` → `/owner/work/edit/artifact/[id]`
  - `summary` → `/owner/work/edit/summary/[id]`
  - `client_review` → `/owner/work/review/[id]`
  - And more (see `workPackageLabelRouter.js`)

#### 4. Build Off the Work Package

From the execution dashboard:

1. **Click any item** - Automatically routes to the appropriate edit page based on the item's label
2. **Create deliverables** - Use the item's context to build artifacts
3. **Track progress** - See real-time updates as artifacts are created and linked
4. **Monitor timelines** - Watch phase status change as work progresses

### Key Features

#### Timeline Calculations

- **Expected End Date** = Phase effective date + (total estimated hours ÷ 8 hours/day)
- **Timeline Status** computed daily:
  - Compares today's date to expected end date
  - Accounts for phase completion status
  - Provides visual warnings before deadlines

#### Label-Based Routing

Items automatically route to their appropriate edit pages:
- No need for 20 different buttons
- Simple click-to-edit workflow
- Routes defined in `workPackageLabelRouter.js`
- Fallback to default view if no route mapping exists

#### Progress Tracking

- Items track completed artifacts vs. total quantity
- Phases aggregate item progress
- Work package shows overall completion percentage
- Real-time updates as deliverables are created

### Architecture

#### Server-Side

- **Route**: `/api/workpackages/owner/[id]/hydrate`
- **Service**: `WorkPackageHydrationService.js`
  - Hydrates WorkPackage with phases, items, and artifacts
  - Calculates timeline status for each phase
  - Aggregates hours from items
  - Derives phase effective dates from WorkPackage start date

#### Client-Side

- **Hook**: `useWorkPackageHydration(workPackageId)`
  - Fetches hydrated work package data
  - Includes timeline calculations
  - Same data structure as Client Portal (for consistency)

#### Utilities

- **`workPackageTimeline.js`**:
  - `convertHoursToDays()` - Converts hours to days (8 hours = 1 day)
  - `computeExpectedEndDate()` - Calculates phase end date
  - `computePhaseTimelineStatus()` - Determines timeline status
  - `getTimelineStatusColor()` - Returns Tailwind classes for UI

- **`workPackageLabelRouter.js`**:
  - `labelRouter` - Mapping of labels to routes
  - `getRouteForItem()` - Gets route for an item
  - `buildItemRoute()` - Builds full route with item ID

### Data Flow

```
1. User clicks "View Execution Dashboard"
   ↓
2. Page loads with useWorkPackageHydration hook
   ↓
3. Hook calls /api/workpackages/owner/[id]/hydrate
   ↓
4. Server hydrates WorkPackage:
   - Loads phases with items
   - Calculates aggregated hours per phase
   - Derives effective dates from WorkPackage start
   - Computes expected end dates
   - Calculates timeline status
   - Loads artifacts for each item
   ↓
5. Client receives hydrated data
   ↓
6. UI renders:
   - Phase timeline status badges
   - Clickable items with label routing
   - Progress indicators
   - Item statistics
```

### WorkPackage Association Issues

#### Current Schema

**WorkPackage Model:**
```prisma
model WorkPackage {
  id        String   @id @default(cuid())
  contactId String   // Required - links to Contact
  contact   Contact  @relation(...)
  
  companyId String?  // Optional - links to Company (legacy?)
  company   Company? @relation(...)
  
  // ... other fields
}
```

#### Current Association Pattern

**WorkPackage → Contact → ContactCompany (indirect)**
- WorkPackage has `contactId` (required)
- Contact has `contactCompanyId` (optional)
- WorkPackage can access contactCompany via `contact.contactCompany`

**Issues:**
1. ❌ **No direct `contactCompanyId` on WorkPackage** - Must go through contact
2. ❌ **API tries to include `contactCompany` directly** - But schema doesn't support it
3. ⚠️ **Filtering by contactCompany requires join** - Less efficient

#### Proposed Refactor: ContactCompany-First Approach

**Goal:** Filter work packages by `contactCompanyId` (cleaner, more efficient) while maintaining `contactId` for hydration and user login.

**Why ContactCompany-First?**
1. **Business Logic:** Work packages are typically scoped to a company, not an individual contact
2. **Efficiency:** Direct filtering by `contactCompanyId` is faster than joining through contacts
3. **Cleaner Queries:** Can filter all work packages for a company in one query
4. **Scalability:** Better for companies with multiple contacts

**Proposed Schema Change:**
```prisma
model WorkPackage {
  id                String   @id @default(cuid())
  contactId         String   // Required - for hydration/user login
  contact           Contact  @relation(...)
  
  contactCompanyId  String?  // NEW - Direct link to company (for filtering)
  contactCompany   Company? @relation(fields: [contactCompanyId], references: [id])
  
  companyId         String?  // Legacy? - may be redundant with contactCompanyId
  company           Company? @relation(...)
  
  // ... other fields
  
  @@index([contactId])
  @@index([contactCompanyId]) // NEW
  @@index([companyId])
}
```

### Best Practices

1. **Always set `effectiveStartDate`** on WorkPackage for accurate timeline calculations
2. **Use consistent labels** for items to leverage automatic routing
3. **Update item status** as work progresses (not_started → in_progress → completed)
4. **Link artifacts** to items via Collateral model for progress tracking
5. **Review timeline status** regularly to catch overdue phases early

### Future Enhancements

- [ ] Notifications for overdue phases
- [ ] Reminders for approaching deadlines
- [ ] Task-level scheduling (beyond phase-level)
- [ ] Gantt chart visualization
- [ ] Bulk operations on items
- [ ] Export execution reports

---

## Data Relationships

**Contact-First Hierarchy:**
```
CompanyHQ (Tenant/Owner)
  └── Contact (Person)
        ├── Firebase Account (email = Contact.email)
        ├── contactCompanyId → Company (Client Business)
        │     ├── Proposal[] (Engagements)
        │     │     └── ConsultantDeliverable[] (Deliverables)
        │     └── contractId (Formal agreement)
        └── ConsultantDeliverable[] (What we're providing)
              └── Linked to Proposal
```

**Key Associations:**
- `Contact.email` → Firebase Auth (universal personhood)
- `Contact.firebaseUid` → Firebase UID (stored in Contact model)
- `Contact.contactCompanyId` → `Company.id` (Contact works for Company)
- `Proposal.companyId` → `Company.id` (Proposal is for Company)
- `ConsultantDeliverable.contactId` → `Contact.id` (Deliverable is for Contact)
- `ConsultantDeliverable.proposalId` → `Proposal.id` (Deliverable from Proposal)
- `ConsultantDeliverable.companyHQId` → `CompanyHQ.id` (Tenant boundary)
- `ConsultantDeliverable.workContent` → JSON (Actual work artifact - indicates work started)

---

## API Endpoints

### Owner Side (IgniteBD)

**POST /api/deliverables**
- Create deliverable
- Body: `{ contactId, title, description, category, proposalId, milestoneId, dueDate, status, workContent }`
- Auth: Required (Firebase token)

**GET /api/deliverables?contactId=xxx**
- List deliverables for contact
- Auth: Optional (scoped by contactId)

**PUT /api/deliverables/:deliverableId**
- Update deliverable status/workContent
- Body: `{ status, completedAt, notes, workContent }`
- Auth: Required (Firebase token)

**POST /api/contacts/:contactId/generate-portal-access**
- Generate portal access for contact
- Creates Firebase account, generates InviteToken
- Returns activation link
- Auth: Required (Firebase token)

**GET /api/workpackages/client/:contactId**
- Get work packages for contact (client view - published artifacts only)
- Returns: WorkPackages with hydrated artifacts
- Auth: Required (Firebase token)

### Client Portal Endpoints

**See:** `ignitebd-clientportal/docs/CLIENT_PORTAL_DEV_GUIDE.md` for full client portal API documentation

---

## Key Takeaways

**Owner-Side:**
1. **Contact-First** - All operations start with Contact
2. **Tenant Scoping** - Everything linked to `companyHQId`
3. **Proposal → Deliverables** - When proposal approved, convert to deliverables
4. **Work Content** - `workContent` field indicates work has started
5. **Upsert Pattern** - Link to tenant, then create based on contact/company associations

**Client Portal:**
- See `ignitebd-clientportal/docs/CLIENT_PORTAL_DEV_GUIDE.md` for full client portal details

**Work Has Started Indicator:**
- Deliverables with `workContent` (JSON field with actual work artifacts)
- OR deliverables with status "in-progress" or "completed"
- Used by welcome router to determine routing

---

## Related Documentation

- **`ignitebd-clientportal/docs/CLIENT_PORTAL_DEV_GUIDE.md`** - **Client portal dev guide (what clients see)**
- **`ignitebd-clientportal/README.md`** - Client portal setup
- **`ignitebd-clientportal/docs/PROPOSAL_STRUCTURE.md`** - Proposal data structure
- **`HYDRATION_ARCHITECTURE.md`** - Hydration patterns
- **`docs/AUTHENTICATION.md`** - Complete authentication guide

---

**Last Updated**: November 2025  
**Architecture**: Contact-First (Universal Personhood)  
**Owner Side**: Proposal → Deliverables → Work Content  
**Client Portal**: Strategic Routing → Proposal View or Dashboard  
**Work Indicator**: `workContent` field or active status  
**Authentication**: Contact.email + Firebase  
**Portal**: Separate Next.js app, shared database

