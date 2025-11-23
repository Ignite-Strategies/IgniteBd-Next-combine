# Deliverable System - What We Give to Clients

## 🎯 Core Concept

**Deliverables = The things we give to clients**

Deliverables are the actual work items, content, and services that get delivered to a client. They're the tangible outputs of our work.

## 📋 Deliverable Models in the System

### 1. DeliverableTemplate (Reusable Template)
**Location**: `CompanyHQ` level (tenant-scoped templates)

**Purpose**: 
- Reusable template that defines **what types of deliverables** you offer
- Used to build proposals and work packages
- Think of it as a "catalog item" for deliverables

**Schema**:
```prisma
model DeliverableTemplate {
  id                        String                     @id @default(cuid())
  companyHQId               String
  companyHQ                 CompanyHQ                  @relation(...)
  
  deliverableType           String  // e.g., "BLOG", "PERSONA", "CLE_DECK"
  deliverableLabel          String  // Human-readable: "Blog Posts", "Target Personas"
  defaultUnitOfMeasure      String  // "day" | "week" | "month"
  defaultDuration           Int     // Duration in the above unit
  
  phaseDeliverableTemplates PhaseDeliverableTemplate[]  // Links to phases
  
  @@unique([companyHQId, deliverableType])
  @@map("deliverable_templates")
}
```

**Example**:
```javascript
{
  id: "del-temp-1",
  companyHQId: "hq-123",
  deliverableType: "BLOG",
  deliverableLabel: "Blog Posts",
  defaultUnitOfMeasure: "week",
  defaultDuration: 2
}
```

**Usage**:
- Created in Template Library (`/templates/library`)
- Used when building proposals (select from templates)
- Used when building work packages (select from templates)
- **NOT the actual deliverable** - just a template/blueprint

---

### 2. ProposalDeliverable (Proposal-Specific)
**Location**: `Proposal` level (client-specific)

**Purpose**:
- Actual deliverable line items **in a proposal**
- Detached copy from template (no template link after creation)
- What gets shown to the client in the proposal

**Schema**:
```prisma
model ProposalDeliverable {
  id         String   @id @default(cuid())
  proposalId String
  proposal   Proposal @relation(...)
  
  // Detached copy fields (hydrated from template at creation, then standalone)
  name        String   // deliverableName from template
  description String?
  quantity    Int      @default(1)
  
  // Pricing fields
  unitPrice  Float?
  totalPrice Float?    // quantity * unitPrice
  
  // Metadata stored as JSON in notes
  notes      String?  // JSON: { phaseName, unit, durationUnit, durationUnits }
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([proposalId])
  @@map("proposal_deliverables")
}
```

**Example**:
```javascript
{
  id: "prop-del-1",
  proposalId: "prop-123",
  name: "Blog Posts",  // From DeliverableTemplate.deliverableLabel
  description: "5 blog posts on growth strategies",
  quantity: 5,
  unitPrice: 500.00,
  totalPrice: 2500.00,
  notes: '{"phaseName":"Content Creation","unit":"post","durationUnit":"hour","durationUnits":8}'
}
```

**Usage**:
- Created when building proposals (from templates or CSV)
- Shown to client in proposal document
- **This is what the client sees** - the actual deliverable they're buying

---

### 3. WorkPackageItem (Work Package Deliverable)
**Location**: `WorkPackage` level (client-specific work items)

**Purpose**:
- Deliverable items **in a work package** (the actual work to be done)
- Links to phases within the work package
- Tracks progress (quantity owed vs completed)

**Schema**:
```prisma
model WorkPackageItem {
  id                 String           @id @default(cuid())
  workPackageId      String
  workPackage        WorkPackage      @relation(...)
  
  workPackagePhaseId String           // Required - belongs to a phase
  workPackagePhase   WorkPackagePhase @relation(...)
  
  itemType        String  // BLOG, PERSONA, CLE_DECK, etc.
  itemLabel       String  // "Blog Posts", "Target Personas"
  itemDescription String?
  
  quantity      Int
  unitOfMeasure String  // "day" | "week" | "month"
  duration      Int     // Duration value
  status        String  @default("todo") // todo | in_progress | completed
  
  collateral Collateral[]  // Links to actual artifacts (Blog, Persona, etc.)
  
  createdAt DateTime @default(now())
  
  @@map("work_package_items")
}
```

**Example**:
```javascript
{
  id: "wp-item-1",
  workPackageId: "wp-123",
  workPackagePhaseId: "phase-1",
  itemType: "BLOG",
  itemLabel: "Blog Posts",
  itemDescription: "5 blog posts on growth strategies",
  quantity: 5,
  unitOfMeasure: "week",
  duration: 2,
  status: "in_progress"
}
```

**Usage**:
- Created when building work packages (from templates or CSV)
- Tracks what work needs to be done
- Links to actual artifacts (Blog, Persona, etc.) via `collateral` relation
- **This is what gets worked on** - the actual deliverables being produced

---

### 4. ConsultantDeliverable (Client-Facing Deliverable)
**Location**: `Contact` level (client-specific)

**Purpose**:
- The **actual delivered work** to a specific client
- Contains the work content (JSON with actual artifacts)
- What shows in the client portal

**Schema**:
```prisma
model ConsultantDeliverable {
  id          String    @id @default(cuid())
  contactId   String    // The client
  contact     Contact   @relation(...)
  companyHQId String    // Tenant scoping
  
  title       String
  description String?
  category    String    // "foundation", "integration", "enrichment"
  type        String    // "persona", "blog", "upload"
  
  workContent Json?     // Actual work artifact (JSON)
  status      String    // "pending" | "in-progress" | "completed" | "blocked"
  
  proposalId String?    // Optional link to proposal
  milestoneId String?   // Reference to milestone in proposal
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("consultant_deliverables")
}
```

**Example**:
```javascript
{
  id: "del-1",
  contactId: "contact-123",
  title: "Target Persona: Marketing Director",
  description: "Detailed persona for marketing directors",
  category: "foundation",
  type: "persona",
  workContent: {
    name: "Marketing Director",
    role: "Director of Marketing",
    goals: ["Increase brand awareness", "Generate leads"],
    painPoints: ["Limited budget", "Need to prove ROI"]
  },
  status: "completed",
  proposalId: "prop-123"
}
```

**Usage**:
- Created when proposal is approved (converted from ProposalDeliverable)
- Contains actual work content (the thing we give to the client)
- Shown in client portal (`/dashboard`)
- **This is the actual deliverable** - the real work artifact

---

## 🔄 Flow: Template → Proposal → Work Package → Deliverable

### 1. Template (Reusable Blueprint)
```
DeliverableTemplate
├── deliverableType: "BLOG"
├── deliverableLabel: "Blog Posts"
└── defaultDuration: 2 weeks
```

### 2. Proposal (What Client Buys)
```
Proposal
└── ProposalDeliverable
    ├── name: "Blog Posts" (from template)
    ├── quantity: 5
    └── totalPrice: $2,500
```

### 3. Work Package (What We Do)
```
WorkPackage
└── WorkPackageItem
    ├── itemLabel: "Blog Posts"
    ├── quantity: 5
    └── status: "in_progress"
```

### 4. ConsultantDeliverable (What Client Gets)
```
ConsultantDeliverable
├── title: "Blog Post: Growth Strategies"
├── workContent: { actual blog content }
└── status: "completed"
```

---

## 🎯 Key Distinctions

| Model | Level | Purpose | Contains Content? |
|-------|-------|---------|-------------------|
| **DeliverableTemplate** | CompanyHQ | Reusable template | ❌ No - just metadata |
| **ProposalDeliverable** | Proposal | What client buys | ❌ No - just line item |
| **WorkPackageItem** | WorkPackage | What we work on | ❌ No - links to artifacts |
| **ConsultantDeliverable** | Contact | What client gets | ✅ Yes - has workContent |

---

## 💡 Mental Model

**Deliverables = Things We Give to Clients**

1. **Template** → "We offer blog posts" (catalog item)
2. **Proposal** → "You're buying 5 blog posts for $2,500" (what they're buying)
3. **Work Package** → "We need to create 5 blog posts" (what we're doing)
4. **ConsultantDeliverable** → "Here's Blog Post #1: Growth Strategies" (what they got)

---

## 📝 For CSV Upload (Work Packages)

When creating work packages from CSV, we're creating **WorkPackageItem** records:

```javascript
// CSV Row
{
  phaseName: "Content Creation",
  itemLabel: "Blog Posts",
  itemType: "BLOG",
  quantity: 5,
  duration: 2,
  unitOfMeasure: "week"
}

// Becomes WorkPackageItem
{
  workPackageId: "wp-123",
  workPackagePhaseId: "phase-1",  // Created from phaseName
  itemLabel: "Blog Posts",
  itemType: "BLOG",
  quantity: 5,
  duration: 2,
  unitOfMeasure: "week",
  status: "todo"
}
```

**Note**: WorkPackageItem requires a phase, so CSV must include `phaseName` to create/find the phase.

