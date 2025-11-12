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
4. Create Deliverables - link to contactId and proposalId
```

**Upsert Pattern:**
```javascript
// All upserts follow this pattern:
// 1. Link to tenant (companyHQId)
// 2. Create/update based on contact/companyId associations

// Example: Company upsert
const company = await upsertCompany({
  companyHQId,        // Tenant boundary
  companyName,         // Company name
  contactCompanyId,   // Link via contact association
});

// Example: Proposal creation
const proposal = await createProposal({
  companyHQId,        // Tenant boundary
  companyId,          // Link to Company (from contactCompanyId)
  contactId,          // Link to Contact
  // ... proposal data
});
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
        └── contactCompanyId → Company (Client Business)
              └── Proposal (Engagement)
                    └── ConsultantDeliverable (What we're providing)
```

**Key Associations:**
- `Contact.contactCompanyId` → `Company.id` (Contact works for Company)
- `Proposal.companyId` → `Company.id` (Proposal is for Company)
- `ConsultantDeliverable.contactId` → `Contact.id` (Deliverable is for Contact)
- `ConsultantDeliverable.proposalId` → `Proposal.id` (Deliverable from Proposal)

---

## Consultant Deliverables

### The Deliverable Model

**What We Need:**
- Deliverables linked to `contactId` (the client contact)
- Track what we're providing
- Show status (pending, in-progress, completed)
- Link to phases/milestones from Proposal

### Proposed Schema Addition

```prisma
model ConsultantDeliverable {
  id          String   @id @default(cuid())
  contactId   String   // Link to Contact (the client)
  contact    Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  
  // What we're delivering
  title       String
  description String?
  category    String? // "foundation", "integration", "enrichment", etc.
  
  // Status tracking
  status      String   @default("pending") // "pending" | "in-progress" | "completed" | "blocked"
  
  // Link to proposal/milestone
  proposalId  String?
  proposal    Proposal? @relation(fields: [proposalId], references: [id], onDelete: SetNull)
  milestoneId String? // Reference to milestone in Proposal.milestones JSON
  
  // Delivery tracking
  dueDate     DateTime?
  completedAt DateTime?
  notes       String?
  
  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([contactId])
  @@index([proposalId])
  @@map("consultant_deliverables")
}
```

### Deliverable Operations

**Create Deliverable:**
```javascript
// POST /api/deliverables
{
  contactId: 'xxx',
  title: '3 Target Personas',
  description: 'Define and document 3 target personas for outreach',
  category: 'foundation',
  proposalId: 'yyy',
  milestoneId: 'milestone-1',
  dueDate: '2025-11-15',
  status: 'in-progress'
}
```

**Update Status:**
```javascript
// PUT /api/deliverables/:deliverableId
{
  status: 'completed',
  completedAt: '2025-11-14',
  notes: 'Delivered personas document via email'
}
```

**Get Deliverables for Client:**
```javascript
// GET /api/deliverables?contactId=xxx
// Returns all deliverables for this client contact
```

---

## Contract Management

### Contract Model

**Current State:**
- `Company.contractId` - String field that can link to contract
- Contract details likely stored externally or in Proposal

**Contract Operations:**

**Link Contract to Company:**
```javascript
// PUT /api/companies/:companyId
{
  contractId: 'contract-xxx',
  // Contract details might be in separate system
  // Or stored in Proposal.compensation
}
```

**Get Contract Info:**
```javascript
// GET /api/companies/:companyId
// Returns Company with contractId
// Contract details come from Proposal or external system
```

**Key Point:** Contract is the **formal agreement**. It drives:
- What we're delivering (ConsultantDeliverable)
- Payment schedule (Proposal.compensation)
- Timeline (Proposal.milestones)

---

## Client Portal Hydration

### Portal Purpose

**The Client Portal hydrates on load and shows:**

1. **What We're Providing** - List of ConsultantDeliverables with status
2. **Status** - Current state of all deliverables and milestones
3. **Pay Your Bills** - Payment schedule, invoices, payment status

### Hydration Endpoint

**Route:** `GET /api/proposals/:proposalId/portal`

**What Gets Hydrated:**

```javascript
{
  success: true,
  portalData: {
    // Client info
    client: {
      name: "Joel Gulick",
      company: "BusinessPoint Law",
      contactEmail: "joel@businesspointlaw.com",
      contactId: "xxx"
    },
    
    // Contract info
    contract: {
      contractId: "contract-xxx",
      status: "active",
      signedDate: "2025-11-03"
    },
    
    // What we're providing (deliverables)
    deliverables: [
      {
        id: "del-1",
        title: "3 Target Personas",
        status: "completed",
        completedAt: "2025-11-10",
        category: "foundation"
      },
      {
        id: "del-2",
        title: "Microsoft Graph OAuth Setup",
        status: "in-progress",
        dueDate: "2025-11-20",
        category: "integration"
      },
      // ... more deliverables
    ],
    
    // Proposal structure
    proposal: {
      id: "proposal-xxx",
      purpose: "...",
      phases: [/* phase data */],
      milestones: [/* milestone data */],
      status: "active"
    },
    
    // Payment info
    payments: [
      {
        id: "payment-1",
        amount: 500,
        dueDate: "2025-11-15",
        status: "pending",
        description: "Kickoff payment"
      },
      // ... more payments
    ],
    
    // Overall status
    status: {
      overall: "in-progress",
      completedDeliverables: 3,
      totalDeliverables: 8,
      nextMilestone: "Week 4: Midpoint",
      nextPayment: {
        amount: 500,
        dueDate: "2025-11-15"
      }
    }
  }
}
```

### Portal Load Flow

**On Portal Load:**
```javascript
// Client Portal loads with engagementId (proposalId)
useEffect(() => {
  const engagementId = params.engagementId;
  
  // Hydrate everything on load
  fetch(`/api/proposals/${engagementId}/portal`)
    .then(res => res.json())
    .then(data => {
      setPortalData(data.portalData);
      // Portal now shows:
      // - What we're providing (deliverables)
      // - Status of everything
      // - Payment schedule
    });
}, [params.engagementId]);
```

**What Client Sees:**
1. **Landing Page** - Welcome, overview, navigation
2. **Deliverables View** - List of what we're providing with status
3. **Timeline** - Milestones and progress
4. **Payments** - Payment schedule, invoices, pay bills

---

## Operations-Focused Workflow

### The Real Flow (Not Pipeline Stages)

**1. Contact + Contract**
```
Contact exists (from outreach, upload, etc.)
Contract signed → Company.contractId set
Proposal created → Linked to Company
```

**2. Deliverables Created**
```
For each phase/milestone in Proposal:
  - Create ConsultantDeliverable
  - Link to contactId
  - Link to proposalId/milestoneId
  - Set dueDate from milestone
```

**3. Work Begins**
```
Deliverables status: pending → in-progress
Update as work progresses
Mark completed when done
```

**4. Client Portal Active**
```
Client accesses portal
Portal hydrates on load:
  - Shows all deliverables (what we're providing)
  - Shows status of each
  - Shows payment schedule
  - Client can pay bills
```

**5. Payments Processed**
```
Payment due → Invoice sent
Client pays via portal
Payment status updated
Next payment scheduled
```

**6. Engagement Complete**
```
All deliverables completed
Final payment processed
Portal shows completion status
Relationship continues for future work
```

---

## Data Model Relationships

### Core Relationships

```
Contact (Client)
  ├── ConsultantDeliverable[] (what we're providing)
  │     └── ConsultantDeliverable → Proposal (engagement plan)
  │
  └── Contact → Company (client company)
        └── Company.contractId (formal agreement)
        └── Company → Proposal[] (engagements)
              └── Proposal.compensation (payment schedule)
              └── Proposal.milestones (timeline)
```

### Key Links

**Contact → Deliverables:**
- `ConsultantDeliverable.contactId` → `Contact.id`
- One Contact can have many Deliverables
- Deliverables show "what we're providing" to this client

**Company → Contract:**
- `Company.contractId` → Contract (external or in Proposal)
- Contract defines the engagement

**Proposal → Everything:**
- `ConsultantDeliverable.proposalId` → `Proposal.id`
- `Proposal.compensation` → Payment schedule
- `Proposal.milestones` → Timeline
- `Proposal.phases` → Work structure

---

## Client Portal Implementation

### Portal Structure

**Pages:**
- `/` - Landing (overview, what we're providing, status summary)
- `/deliverables` - List of all deliverables with status
- `/timeline` - Milestones and progress
- `/payments` - Payment schedule, invoices, pay bills
- `/proposal` - Full proposal view (optional)

### Portal Components

**DeliverablesList:**
```javascript
// Shows what we're providing
{deliverables.map(deliverable => (
  <DeliverableCard
    title={deliverable.title}
    status={deliverable.status}
    dueDate={deliverable.dueDate}
    completedAt={deliverable.completedAt}
  />
))}
```

**StatusSummary:**
```javascript
// Overall status
<StatusCard
  completed={status.completedDeliverables}
  total={status.totalDeliverables}
  nextMilestone={status.nextMilestone}
  progress={progressPercentage}
/>
```

**PaymentSchedule:**
```javascript
// Pay your bills
{payments.map(payment => (
  <PaymentCard
    amount={payment.amount}
    dueDate={payment.dueDate}
    status={payment.status}
    onPay={() => handlePayment(payment.id)}
  />
))}
```

### Portal Hydration API

**Endpoint:** `GET /api/proposals/:proposalId/portal`

**Implementation:**
```javascript
// src/app/api/proposals/[proposalId]/portal/route.js
export async function GET(request, { params }) {
  const { proposalId } = params;
  
  // Get proposal
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      company: {
        include: {
          contacts: {
            take: 1 // Primary contact
          }
        }
      }
    }
  });
  
  // Get deliverables for the contact
  const contactId = proposal.company.contacts[0]?.id;
  const deliverables = await prisma.consultantDeliverable.findMany({
    where: { contactId },
    orderBy: { dueDate: 'asc' }
  });
  
  // Transform to portal format
  const portalData = {
    client: {
      name: proposal.clientName,
      company: proposal.clientCompany,
      contactEmail: proposal.company.contacts[0]?.email,
      contactId
    },
    contract: {
      contractId: proposal.company.contractId,
      status: proposal.status === 'approved' ? 'active' : 'pending'
    },
    deliverables: deliverables.map(d => ({
      id: d.id,
      title: d.title,
      status: d.status,
      category: d.category,
      dueDate: d.dueDate,
      completedAt: d.completedAt
    })),
    proposal: {
      id: proposal.id,
      purpose: proposal.purpose,
      phases: proposal.phases,
      milestones: proposal.milestones,
      status: proposal.status
    },
    payments: proposal.compensation?.paymentSchedule || [],
    status: calculateStatus(deliverables, proposal)
  };
  
  return NextResponse.json({ success: true, portalData });
}
```

---

## API Endpoints

### Deliverables

**Create Deliverable**
```
POST /api/deliverables
Body: { contactId, title, description, category, proposalId, milestoneId, dueDate }
Response: { success: true, deliverable: {...} }
Auth: Required (Firebase token)
```

**Get Deliverables**
```
GET /api/deliverables?contactId=xxx
Response: { success: true, deliverables: [...] }
Auth: Optional (scoped by contactId)
```

**Update Deliverable Status**
```
PUT /api/deliverables/:deliverableId
Body: { status, completedAt?, notes? }
Response: { success: true, deliverable: {...} }
Auth: Required (Firebase token)
```

### Portal

**Get Portal Data (Hydration)**
```
GET /api/proposals/:proposalId/portal
Response: { success: true, portalData: {...} }
Auth: Optional (public with proposalId)
```

**Update Payment Status**
```
PUT /api/proposals/:proposalId/payments/:paymentId
Body: { status: 'paid', paidAt?, transactionId? }
Response: { success: true, payment: {...} }
Auth: Optional (can be public for client payment)
```

### Contracts

**Link Contract**
```
PUT /api/companies/:companyId
Body: { contractId }
Response: { success: true, company: {...} }
Auth: Required (Firebase token)
```

---

## Operations Best Practices

### 1. Deliverable Management

**Create Deliverables from Proposal:**
- When Proposal is approved, create ConsultantDeliverable for each milestone
- Link to contactId (the client)
- Set dueDate from milestone timeline
- Status starts as 'pending'

**Update Status Regularly:**
- Move to 'in-progress' when work starts
- Mark 'completed' when delivered
- Add notes for context
- Update completedAt timestamp

**Track Blockers:**
- If deliverable is blocked, set status to 'blocked'
- Add notes explaining blocker
- Client sees this in portal

### 2. Client Portal Experience

**On Load:**
- Hydrate everything immediately
- Show clear status of all deliverables
- Display payment schedule prominently
- Make "Pay Bills" action obvious

**Status Visibility:**
- Green = Completed
- Yellow = In Progress
- Red = Blocked/Overdue
- Gray = Pending

**Payment Clarity:**
- Show amount, due date, status
- Make payment action clear
- Show payment history
- Display next payment prominently

### 3. Contract Management

**Link Early:**
- Set Company.contractId when contract is signed
- Link Proposal to Company
- Create deliverables from Proposal

**Track Status:**
- Contract status drives engagement status
- Active contract = active engagement
- Completed contract = engagement complete

### 4. Communication

**Transparency:**
- Client portal shows everything
- No surprises
- Real-time status updates
- Clear next steps

**Proactive Updates:**
- Update deliverable status as work progresses
- Notify client of completions
- Alert on blockers
- Remind of upcoming payments

---

## Migration Path

### Phase 1: Add Deliverables Model

**Schema Migration:**
```prisma
// Add ConsultantDeliverable model
model ConsultantDeliverable {
  // ... (see schema above)
}

// Update Contact model
model Contact {
  // ... existing fields
  deliverables ConsultantDeliverable[]
}
```

**API Implementation:**
- Create `/api/deliverables` endpoints
- Link to existing Proposal system
- Create deliverables from Proposal milestones

### Phase 2: Portal Hydration

**Backend:**
- Create `GET /api/proposals/:proposalId/portal` endpoint
- Aggregate deliverables, payments, status
- Transform to portal format

**Frontend:**
- Update Client Portal to fetch from API
- Replace mock data with real hydration
- Show deliverables, status, payments

### Phase 3: Payment Integration

**Payment Processing:**
- Integrate payment gateway (Stripe, etc.)
- Handle payment status updates
- Update Proposal.compensation.paymentSchedule

**Portal:**
- Add "Pay Now" functionality
- Show payment history
- Display receipts

### Phase 4: Real-Time Updates

**WebSocket/SSE:**
- Real-time deliverable status updates
- Payment status changes
- Milestone completions

**Notifications:**
- Email on deliverable completion
- Payment reminders
- Status change alerts

---

## Key Takeaways

**Pipeline Stages = Just Config**
- Stages help organize but don't create value
- Focus on deliverables, contracts, payments

**What Actually Matters:**
1. **ConsultantDeliverable** - What we're providing (linked to contactId)
2. **ContractId** - Formal agreement (Company.contractId)
3. **Status** - Real-time visibility
4. **Payments** - Clear billing and payment

**Client Portal Hydrates On Load:**
- Shows what we're providing (deliverables)
- Shows status of everything
- Shows payment schedule
- Client can pay bills

**Operations-Focused:**
- Less about pipeline stages
- More about actual work and value
- Clear deliverables tracking
- Transparent status and payments

---

## Related Documentation

- **`ignitebd_stack_nextguide.md`** - Main stack documentation
- **`HYDRATION_ARCHITECTURE.md`** - Hydration patterns
- **`ignitebd-clientportal/README.md`** - Client portal setup
- **`ignitebd-clientportal/docs/PROPOSAL_STRUCTURE.md`** - Proposal data structure

---

## Current Status

**✅ Completed:**
- Proposal model with phases, milestones, payments
- Client Portal UI/UX
- Company.contractId field exists

**🚧 In Progress:**
- ConsultantDeliverable model (needs to be added)
- Portal hydration endpoint
- Deliverables API

**📋 Future:**
- Payment processing integration
- Real-time status updates
- Deliverable completion workflows

---

**Last Updated**: November 2025  
**Architecture**: Operations-Focused (Deliverables, Contracts, Payments)  
**Pipeline Stages**: Just Configuration  
**Client Portal**: Hydrates on Load - Shows What We're Providing, Status, Pay Bills  
**Multi-Tenancy**: CompanyHQ-scoped
