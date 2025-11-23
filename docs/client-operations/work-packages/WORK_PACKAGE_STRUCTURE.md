# Work Package Structure - Current State

## 📋 Current Schema (Prisma)

### WorkPackage (Container)
```prisma
model WorkPackage {
  id        String  @id @default(cuid())
  contactId String
  contact   Contact @relation(...)
  
  phases WorkPackagePhase[]  // ⚠️ PHASES EXIST IN SCHEMA
  items  WorkPackageItem[]    // Items can exist at package level OR phase level
  
  companyId String?
  company   Company? @relation(...)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([contactId])
  @@map("work_packages")
}
```

### WorkPackagePhase (Phases within Package)
```prisma
model WorkPackagePhase {
  id            String      @id @default(cuid())
  workPackageId String
  workPackage   WorkPackage @relation(...)
  
  name               String  // Phase name (e.g., "Collateral Generation")
  position           Int     // Order (1, 2, 3...)
  phaseTotalDuration Int     // Duration in business days
  
  items WorkPackageItem[]  // Items belong to a phase
  
  createdAt DateTime @default(now())
  
  @@index([workPackageId])
  @@index([position])
  @@map("work_package_phases")
}
```

### WorkPackageItem (Deliverables/Items)
```prisma
model WorkPackageItem {
  id                 String           @id @default(cuid())
  workPackageId      String           // Required - item belongs to package
  workPackage        WorkPackage      @relation(...)
  
  workPackagePhaseId String           // Required - item belongs to a phase
  workPackagePhase   WorkPackagePhase @relation(...)
  
  itemType        String  // BLOG, PERSONA, CLE_DECK, etc.
  itemLabel       String  // Human-facing name ("CLE Presentation")
  itemDescription String?
  
  quantity      Int
  unitOfMeasure String  // "day" | "week" | "month"
  duration      Int     // Duration value
  status        String  @default("todo") // todo | in_progress | completed
  
  collateral Collateral[]  // Links to actual artifacts
  
  createdAt DateTime @default(now())
  
  @@index([workPackageId])
  @@index([workPackagePhaseId])
  @@index([itemType])
  @@index([status])
  @@map("work_package_items")
}
```

## 🔍 Key Observations

### ✅ What EXISTS:
1. **WorkPackage** - Container (has contactId, companyId)
2. **WorkPackagePhase** - Phases within package (name, position, duration)
3. **WorkPackageItem** - Items that belong to BOTH package AND phase

### ⚠️ Confusion Points:
1. **Phases ARE in the schema** - Despite docs saying "simplified", phases exist
2. **Items require a phase** - `workPackagePhaseId` is required (not optional)
3. **Items are nested** - Items belong to phases, not directly to packages

### 🤔 Questions to Resolve:
1. **Are phases deprecated?** - Docs suggest simplified model without phases, but schema has them
2. **Can items exist without phases?** - Currently schema requires `workPackagePhaseId`
3. **Should we flatten like proposals?** - Proposals have flat `ProposalDeliverable` at proposal level

## 📊 Comparison: Proposal vs Work Package

### Proposal Structure (Current - Flat):
```
Proposal
├── ProposalPhase (timeline/phases)
└── ProposalDeliverable (FLAT - at proposal level, no phase link required)
    ├── name
    ├── description
    ├── quantity
    └── notes (JSON with phaseName, unit, durationUnit, durationUnits)
```

### Work Package Structure (Current - Nested):
```
WorkPackage
├── WorkPackagePhase (required structure)
│   └── WorkPackageItem (nested - requires phase)
│       ├── itemType
│       ├── itemLabel
│       ├── quantity
│       └── duration
```

## 🎯 Recommendation for CSV Upload

To match the proposal CSV pattern, we have two options:

### Option 1: Keep Current Structure (Nested)
- CSV creates WorkPackage → WorkPackagePhase → WorkPackageItem
- CSV must include phaseName to group items
- More complex but maintains current schema

### Option 2: Flatten Like Proposals (Recommended)
- Add optional `workPackagePhaseId` (make it nullable)
- Allow WorkPackageItem to exist at package level
- Store phaseName in a notes/metadata field
- Simpler CSV structure, matches proposal pattern

## 📝 CSV Structure (Proposed - Matching Proposals)

### CSV Fields (Flat):
```
Required:
- phaseName (string)
- itemLabel (string) - deliverable name
- itemDescription (string, optional)

Optional:
- itemType (BLOG, PERSONA, etc.)
- quantity (number)
- unitOfMeasure (day/week/month)
- duration (number)
- workPackageTitle (string)
- workPackageDescription (string)
```

### Mapping to Schema:
```javascript
WorkPackageItem {
  workPackageId: proposal.id,
  workPackagePhaseId: phase.id, // Find or create phase by name
  itemLabel: row.itemLabel,
  itemDescription: row.itemDescription,
  itemType: row.itemType || 'BLOG',
  quantity: row.quantity || 1,
  unitOfMeasure: row.unitOfMeasure || 'day',
  duration: row.duration || 1,
}
```

## 🚀 Next Steps

1. **Decide on structure** - Keep nested or flatten?
2. **Update schema if needed** - Make workPackagePhaseId optional?
3. **Create CSV upload route** - `/api/workpackages/create/from-csv`
4. **Create CSV upload UI** - Similar to proposal CSV upload
5. **Update documentation** - Consolidate all work package docs

