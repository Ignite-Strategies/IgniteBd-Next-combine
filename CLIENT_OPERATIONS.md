# Client Operations Architecture

## Premise

**Client Operations** is about **delivering value** to clients once they enter our architecture. Pipeline stages are just **configuration** - what matters is:

1. **What we're providing** - Consultant deliverables linked to the client
2. **Status** - Real-time visibility into work progress
3. **Payments** - Clear billing and payment tracking
4. **Contracts** - Formal agreements that drive the engagement

**The Core Reality:**
```
Contact → Contract → Deliverables → Client Portal → Pay Bills
```

Pipeline stages (`prospect/lead`, `prospect/qualified`, `client/kickoff`) are just **operational configuration** - they help organize work but don't define value. What defines value is:

- **ConsultantDeliverable** - What we're actually delivering (linked to `contactId`)
- **ContractId** - The formal agreement (`Company.contractId`)
- **Proposal** - The engagement plan with phases, milestones, payments
- **Status** - Where things stand right now

---

## Universal Personhood: Contact-First Operations

### The Key Insight

**One Contact = Universal Personhood**

- Contact exists in IgniteBD (in funnel, outreach, etc.)
- Same Contact can access Client Portal
- **No new user record needed** - Contact IS the user
- Contact's email = login username
- Generated password = initial access
- Password change = Firebase password reset

### The Flow

```
1. Contact in IgniteBD (funnel, outreach, etc.)
   ↓
2. BD User sends proposal → Generates portal access
   ↓
3. System creates Firebase account for Contact.email
   ↓
4. Generates temporary password
   ↓
5. Sends password reset link (Firebase handles this)
   ↓
6. Contact sets their own password
   ↓
7. Contact logs in with email + password
   ↓
8. Portal hydrates based on ContactId
   ↓
9. Shows proposals, deliverables, timeline, billing
```

### Contact-First Authentication

**No Separate User Model:**
- Contact.email = Firebase email
- Contact.id = Portal identity
- Contact.notes.clientPortalAuth = Firebase UID link

**Password Management:**
- Generated in IgniteBD: `POST /api/contacts/:contactId/generate-portal-access`
- Creates Firebase account with temporary password
- Sends Firebase password reset link
- Contact sets their own password
- Password changes via Firebase: `/settings/password`

---

## Architecture Overview

### Contact-First Operations

**Core Principle:** All operations start with the **Contact** and use `contactCompanyId` associations.

**The Pattern:**
1. **Link to Tenant** - Everything is scoped to `companyHQId` (tenant boundary)
2. **Contact-First** - Start with the Contact (the person)
3. **Company Association** - Use `contactCompanyId` to link Contact → Company
4. **Upsert Pattern** - All upserts follow: link to tenant, then create based on contact/companyId associations

**Example Flow:**
```
1. Select Contact (from contacts list, hydrated from companyHQId)
2. Confirm Business (Company) - upsert Company based on contactCompanyId
3. Create Proposal - link to companyHQId and companyId
4. Generate Portal Access - create Firebase account for Contact.email
5. Send invite link - Contact sets password and logs in
6. Portal hydrates based on ContactId
```

### The Client Operations Model

**What Actually Matters:**

1. **Contact** - The person (universal personhood) - **START HERE**
2. **Company** - The client company (`Company.contractId` links to contract) - **LINKED VIA contactCompanyId**
3. **Contract** - Formal agreement (stored via `contractId`)
4. **ConsultantDeliverable** - What we're delivering (linked to `contactId`)
5. **Proposal** - Engagement plan (phases, milestones, payments) - **LINKED TO companyId**
6. **Client Portal** - Client-facing view that hydrates on load

**Pipeline Stages = Just Config**
- Stages are organizational tools
- They don't create value
- Focus on deliverables, contracts, and payments

### Data Relationships

**Contact-First Hierarchy:**
```
CompanyHQ (Tenant)
  └── Contact (Person)
        ├── Firebase Account (email = Contact.email)
        ├── contactCompanyId → Company (Client Business)
        │     └── Proposal (Engagement)
        │           └── ConsultantDeliverable (What we're providing)
        └── Pipeline (prospect/client stages - just config)
```

**Key Associations:**
- `Contact.email` → Firebase Auth (universal personhood)
- `Contact.contactCompanyId` → `Company.id` (Contact works for Company)
- `Proposal.companyId` → `Company.id` (Proposal is for Company)
- `ConsultantDeliverable.contactId` → `Contact.id` (Deliverable is for Contact)
- `ConsultantDeliverable.proposalId` → `Proposal.id` (Deliverable from Proposal)

---

## Client Portal Architecture

### Separate App, Shared Database

**Product Model:**
- **Standalone Product**: Can be sold independently or as add-on to IgniteBD
- **Self-Contained**: Separate Next.js app, own deployment
- **Shared Database**: Uses same Prisma schema and database as IgniteBD
- **Contact-Based Auth**: Uses Contact.email for Firebase authentication

### Portal Routes

- `/splash` - Auth check (mirrors IgniteBD)
- `/login` - Contact login (email + password via Firebase)
- `/welcome` - Welcome screen
- `/dashboard` - Client portal dashboard
  - Foundational Work (deliverables)
  - Proposals
  - Timeline
  - Settings (password change, billing)

### Portal Hydration

**Based on ContactId:**
1. Contact logs in with email + password (Firebase)
2. System finds Contact by email
3. Portal hydrates proposals for Contact's company
4. Shows deliverables linked to ContactId
5. Displays timeline, payments, status

**No New User Record:**
- Contact IS the user
- Contact.email = Firebase email
- Contact.id = Portal identity
- Universal personhood maintained

---

## API Endpoints

### Generate Portal Access (IgniteBD)

**POST /api/contacts/:contactId/generate-portal-access**

Creates Firebase account for Contact and generates credentials.

**Request:**
```javascript
POST /api/contacts/:contactId/generate-portal-access
Headers: { Authorization: Bearer <firebaseToken> }
```

**Response:**
```javascript
{
  success: true,
  credentials: {
    contactId: "xxx",
    contactEmail: "client@example.com",
    temporaryPassword: "TempPass123!",
    passwordResetLink: "https://firebase-reset-link...",
    loginUrl: "https://portal.ignitegrowth.biz/login"
  }
}
```

**Flow:**
1. Creates/updates Firebase user with Contact.email
2. Sets temporary password
3. Generates Firebase password reset link
4. Stores Firebase UID in Contact.notes
5. Returns credentials + reset link

### Verify Contact (Client Portal)

**POST /api/auth/verify-contact**

Verifies Contact credentials (now handled by Firebase directly).

### Get Contact by Email (Client Portal)

**GET /api/contacts/by-email?email=xxx**

Finds Contact by email for portal login.

### Get Contact Proposals (Client Portal)

**GET /api/contacts/:contactId/proposals**

Gets all proposals for a Contact (for portal access).

---

## Client Portal Flow

### 1. Generate Access (IgniteBD User)

```
BD User → Contact Detail Page
  → Click "Generate Portal Access"
  → POST /api/contacts/:contactId/generate-portal-access
  → System creates Firebase account
  → Returns password reset link
  → BD User sends link to Contact
```

### 2. Contact Sets Password

```
Contact receives email with reset link
  → Clicks link
  → Firebase password reset page
  → Sets their password
  → Redirected to portal login
```

### 3. Contact Logs In

```
Contact goes to portal login
  → Enters email (Contact.email)
  → Enters password (their password)
  → Firebase authenticates
  → System finds Contact by email
  → Stores ContactId in localStorage
  → Redirects to welcome/dashboard
```

### 4. Portal Hydrates

```
Dashboard loads
  → Gets ContactId from localStorage
  → Finds proposals for Contact's company
  → Loads deliverables for ContactId
  → Displays engagement data
```

---

## Key Takeaways

**Universal Personhood:**
- Contact.email = Login username
- Contact.id = Portal identity
- No separate user model needed
- Same person, different contexts

**Password Management:**
- Generated in IgniteBD
- Set by Contact via Firebase reset link
- Changed via Firebase in portal settings
- Managed by Firebase, not custom system

**Contact-First:**
- All operations start with Contact
- Portal access = Contact + Firebase account
- Portal hydrates based on ContactId
- Universal personhood maintained

**Separate App, Shared DB:**
- Client Portal = Separate Next.js app
- Shares same database as IgniteBD
- Direct Prisma access
- Independent deployment

---

## Client Delivery Architecture

### Premise

**Main App = Acquisition Tool**
- IgniteBD is primarily for BD, outreach, pipeline, closing deals
- Client delivery is an **optional feature** for owners who want to manage delivery themselves
- Some owners use it; others sell and hand off to implementation teams
- **Not global** - Keep it scoped to owners/contacts who use it

### Architecture Overview

**Client Delivery = Optional Feature**
- Only for owners who want to manage delivery
- Scoped to specific contacts (contactId-based)
- Modular - can be ignored entirely if not needed
- **Future State**: May be a paid feature (along with payment acceptance, etc.)

### Contact-Based Delivery Flow

**Core Principle:**
- All deliverable work is tied to `contactId`
- Owner selects contact → Creates deliverables → Uploads work
- Each deliverable work artifact is linked to specific contact
- Contact persistence across pages (localStorage/URL params)

**The Flow:**
```
1. Owner selects Company (companyHQId) - already exists
   ↓
2. Owner selects Contact (contactId) within that company
   ↓
3. Persist contact selection (localStorage/URL params)
   ↓
4. Navigate to deliverable build page with ?contactId=xyz
   ↓
5. Page loads with contact banner: "Building for: [Contact Name]"
   ↓
6. Confirm/change contact if needed
   ↓
7. Build work artifact (reuse existing builders)
   ↓
8. On save: Link to contactId, companyHQId, contactCompanyId
```

### Deliverable Structure

**DeliverableProp vs DeliverableWork:**

**DeliverableProp (Template)**
- Stored in Proposal JSON (phases, milestones)
- Modular/template structure
- Defines what COULD be delivered
- Not linked to contact yet

**DeliverableWork (Instance)**
- Actual work artifact tied to contact
- Created when owner selects from proposal
- Links to `contactId`, `companyHQId`, `contactCompanyId`
- Has status (pending, in-progress, completed)
- Contains actual work content (persona, blog, etc.)

**Schema:**
```prisma
model ConsultantDeliverable {
  id              String   @id @default(cuid())
  contactId       String   // Link to Contact (the client)
  contact         Contact  @relation(fields: [contactId], references: [id])
  
  // What we're delivering
  title           String
  description     String?
  category        String?  // "foundation", "integration", "enrichment", etc.
  type            String?  // "persona", "blog", "upload", etc.
  
  // Work content (stored as JSON for flexibility)
  workContent     Json?    // Actual work artifact (persona data, blog content, etc.)
  
  // Status tracking
  status          String   @default("pending") // "pending" | "in-progress" | "completed" | "blocked"
  
  // Link to proposal/milestone (optional - can start fresh)
  proposalId      String?
  proposal        Proposal? @relation(fields: [proposalId], references: [id])
  milestoneId     String?  // Reference to milestone in Proposal.milestones JSON
  
  // Delivery tracking
  dueDate         DateTime?
  completedAt     DateTime?
  notes           String?
  
  // Metadata
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Tenant scoping
  companyHQId     String   // Always linked to owner's company
  contactCompanyId String? // Link to contact's company
  
  @@index([contactId])
  @@index([proposalId])
  @@index([companyHQId])
}
```

### Client Delivery Section (Main App)

**Location:** `/client-operations/deliverables/*`

**Routes:**
- `/client-operations/deliverables` - Deliverables list (select contact)
- `/client-operations/deliverables/client-persona-build?contactId=xyz` - Build persona for contact
- `/client-operations/deliverables/client-blog-build?contactId=xyz` - Build blog for contact
- `/client-operations/deliverables/client-upload?contactId=xyz` - Upload work for contact

**UX Flow:**
1. Owner navigates to Client Delivery section
2. Selects contact (autocomplete/dropdown)
3. Persists contact selection (localStorage/URL params)
4. Navigates to build page with `?contactId=xyz`
5. Page loads with contact banner at top
6. Owner confirms/changes contact if needed
7. Builds work artifact (reuses existing builders)
8. Saves work linked to contactId

### Work Upload UX

**After Deliverables Are Set:**
- Owner clicks "Begin Work" or "Provide Work Sample"
- Creates work upload interface
- Options:
  1. Copy/paste content
  2. Upload file
  3. Build using existing builders (persona, blog, etc.)

**Reuse Existing Builders:**
- `clientbuildpersona` - Reuses persona builder from main app
- `clientbuildblog` - Reuses blog builder from main app
- Same capabilities, but scoped to contact
- All work artifacts linked to `contactId`

**Work Upload Interface:**
```
┌─────────────────────────────────────────┐
│ [CompanyHQ] [Contact Selector] [Save]  │
├─────────────────────────────────────────┤
│ Building persona for: Joel Gulick      │
│ BusinessPoint Law                       │
│ [Change Contact]                        │
├─────────────────────────────────────────┤
│ [Reuse Persona Builder Component]      │
│ ...                                     │
└─────────────────────────────────────────┘
```

### Contract Management

**Current State:**
- **Approved Proposal = Contract** (for now)
- Contract signing happens off-platform
- No separate contract flag needed
- **DeliverableWork existence = Work Has Begun**
- If DeliverableWork exists, work has begun (or ready to begin)
- No need for explicit contract flag

**Routing Logic:**
```
Welcome Router → Check State:
  1. Has DeliverableWork? → Dashboard (work has begun)
  2. Has Approved Proposal? → "Set up deliverables" / Dashboard (empty state)
  3. Has Draft Proposal? → Proposal view
  4. No Proposals? → Onboarding
```

### Client Dashboard (Client Portal)

**Two Sections:**

1. **Status of Your Project**
   - Stoplight chart of DeliverableWork items
   - Green = Completed
   - Yellow = In Progress
   - Red = Blocked/Overdue
   - Gray = Pending
   - Click each to load work artifact

2. **See the Deliverables**
   - List view of all deliverables
   - Similar UX to stoplight chart
   - Click to view work artifact
   - (May be redundant - can combine into single view)

**Hydration:**
- Hydrates DeliverableWork for contact
- Shows status of each deliverable
- Displays work artifacts when clicked
- Keep it simple - don't over-hydrate

### Contact Selection & Persistence

**Contact Selector Component:**
- Dropdown/autocomplete in header/nav
- Shows current selection: "Working for: [Contact Name]"
- Click to change contact
- Persists across pages (localStorage/URL params)

**Persistence Strategy:**
- URL param (`?contactId=xyz`) - Source of truth, bookmarkable
- localStorage (`currentClientContactId`) - Fallback, persists across sessions
- Both - URL is source of truth, localStorage is fallback

**Contact Confirmation:**
- Banner at top with contact info
- "Change Contact" button if wrong
- Confirm dialog if switching mid-build

### Implementation Approach

**Phase 1: Schema Updates**
- Update `ConsultantDeliverable` model with `workContent` (JSON)
- Add `companyHQId` and `contactCompanyId` fields
- Add `type` field for deliverable type (persona, blog, upload, etc.)

**Phase 2: Client Delivery Section**
- Create `/client-operations/deliverables/*` routes
- Add contact selector component
- Create build pages (persona, blog, upload)
- Reuse existing builder components

**Phase 3: Work Upload**
- Create work upload interface
- Link to existing builders (persona, blog)
- Save work artifacts to `ConsultantDeliverable.workContent`
- Link to `contactId`, `companyHQId`, `contactCompanyId`

**Phase 4: Client Dashboard**
- Update client portal dashboard
- Add "Status of Your Project" (stoplight chart)
- Add "See the Deliverables" (list view)
- Load work artifacts on click

### Key Principles

**1. Main App = Acquisition Tool**
- IgniteBD is for BD, outreach, pipeline, closing
- Client delivery is optional, not core
- Don't mess up existing wiring

**2. Contact-Based Architecture**
- All deliverable work tied to `contactId`
- Owner selects contact first
- Persist contact selection across pages
- Each work artifact linked to specific contact

**3. Modular & Scoped**
- Client delivery is optional feature
- Only for owners who use it
- Scoped to specific contacts
- Can be ignored entirely if not needed

**4. Reuse Existing Builders**
- Don't rebuild persona/blog builders
- Reuse existing components
- Same capabilities, scoped to contact
- `clientbuildpersona`, `clientbuildblog`, etc.

**5. Approved Proposal = Contract**
- For now, approved proposal is contract signal
- No separate contract flag needed
- DeliverableWork existence = work has begun
- Keep it simple

**6. Keep It Simple**
- Don't over-hydrate client dashboard
- Simple stoplight chart or list view
- Load work artifacts on click
- MVP first, optimize later

---

## Related Documentation

- **`ignitebd_stack_nextguide.md`** - Main stack documentation
- **`HYDRATION_ARCHITECTURE.md`** - Hydration patterns
- **`ignitebd-clientportal/README.md`** - Client portal setup
- **`ignitebd-clientportal/docs/WELCOME_ROUTER_ARCHITECTURE.md`** - Welcome router logic
- **`ignitebd-clientportal/docs/CONTEXT_AWARE_HYDRATION.md`** - Context-aware hydration

---

**Last Updated**: November 2025  
**Architecture**: Contact-First (Universal Personhood)  
**Main App**: Acquisition Tool (BD, Outreach, Pipeline, Closing)  
**Client Delivery**: Optional Feature (Scoped to Contacts)  
**Contract**: Approved Proposal (For Now)  
**Work Has Begun**: DeliverableWork Existence  
**Authentication**: Contact.email + Firebase  
**Portal**: Separate Next.js app, shared database  
**Password**: Generated → Reset Link → Set by Contact → Changeable

