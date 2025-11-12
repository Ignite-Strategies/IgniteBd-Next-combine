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

## Related Documentation

- **`ignitebd_stack_nextguide.md`** - Main stack documentation
- **`HYDRATION_ARCHITECTURE.md`** - Hydration patterns
- **`ignitebd-clientportal/README.md`** - Client portal setup

---

**Last Updated**: November 2025  
**Architecture**: Contact-First (Universal Personhood)  
**Authentication**: Contact.email + Firebase  
**Portal**: Separate Next.js app, shared database  
**Password**: Generated → Reset Link → Set by Contact → Changeable

