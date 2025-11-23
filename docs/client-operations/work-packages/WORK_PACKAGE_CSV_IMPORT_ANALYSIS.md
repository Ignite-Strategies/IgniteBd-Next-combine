# Work Package CSV Import - Model Analysis & Refactor Proposal

## 📋 Current Schema vs Required Schema

### WorkPackage Model

**Current:**
```prisma
model WorkPackage {
  id        String
  contactId String
  companyId String?
  phases    WorkPackagePhase[]
  items     WorkPackageItem[]
  createdAt DateTime
  updatedAt DateTime
}
```

**Required (from CSV spec):**
- ✅ `contactId` - exists
- ✅ `companyId` - exists
- ❌ `title` - MISSING (needed for proposal title)
- ❌ `description` - MISSING (needed for proposalDescription)
- ❌ `totalCost` - MISSING (needed for proposalTotalCost)
- ❌ `effectiveStartDate` - MISSING (optional, for timeline)

**Proposed Refactor:**
```prisma
model WorkPackage {
  id                String   @id @default(cuid())
  contactId         String
  contact           Contact  @relation(...)
  companyId         String?
  company           Company? @relation(...)
  
  title             String   // NEW - from proposal title
  description       String?  // NEW - from proposalDescription
  totalCost         Float?   // NEW - from proposalTotalCost
  effectiveStartDate DateTime? // NEW - optional timeline start
  
  phases            WorkPackagePhase[]
  items             WorkPackageItem[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([contactId])
  @@index([companyId])
  @@map("work_packages")
}
```

---

### WorkPackagePhase Model

**Current:**
```prisma
model WorkPackagePhase {
  id                String
  workPackageId     String
  name              String
  position          Int
  phaseTotalDuration Int  // business days
  items             WorkPackageItem[]
  createdAt         DateTime
}
```

**Required (from CSV spec):**
- ✅ `name` - exists (from phaseName)
- ✅ `position` - exists (from phasePosition)
- ❌ `description` - MISSING (from phaseDescription)
- ❌ `totalEstimatedHours` - MISSING (computed from items)

**Proposed Refactor:**
```prisma
model WorkPackagePhase {
  id                  String      @id @default(cuid())
  workPackageId       String
  workPackage         WorkPackage @relation(...)
  
  name                String
  position            Int
  description         String?     // NEW - from phaseDescription
  totalEstimatedHours Int?        // NEW - computed aggregate from items
  
  items               WorkPackageItem[]
  
  createdAt           DateTime @default(now())
  
  @@unique([workPackageId, name, position]) // For idempotent upsert
  @@index([workPackageId])
  @@index([position])
  @@map("work_package_phases")
}
```

**Note:** Keep `phaseTotalDuration` for backward compatibility, but add `totalEstimatedHours` for CSV import.

---

### WorkPackageItem Model

**Current:**
```prisma
model WorkPackageItem {
  id                 String
  workPackageId      String
  workPackagePhaseId String
  itemType           String
  itemLabel          String
  itemDescription    String?
  quantity           Int
  unitOfMeasure      String
  duration           Int
  status             String
  createdAt          DateTime
}
```

**Required (from CSV spec):**
- ✅ `itemType` - exists (maps to deliverableType)
- ✅ `itemLabel` - exists (maps to deliverableLabel)
- ✅ `itemDescription` - exists (maps to deliverableDescription)
- ✅ `quantity` - exists
- ✅ `unitOfMeasure` - exists
- ❌ `estimatedHoursEach` - MISSING (replaces duration concept)
- ✅ `status` - exists

**Proposed Refactor:**
```prisma
model WorkPackageItem {
  id                 String           @id @default(cuid())
  workPackageId      String
  workPackage        WorkPackage      @relation(...)
  workPackagePhaseId String
  workPackagePhase   WorkPackagePhase @relation(...)
  
  // CSV fields (aliased for clarity)
  deliverableType        String  // Maps to itemType
  deliverableLabel       String  // Maps to itemLabel
  deliverableDescription String? // Maps to itemDescription
  
  quantity            Int
  unitOfMeasure       String
  estimatedHoursEach  Int            // NEW - replaces duration
  status              String @default("not_started") // Standardize status values
  
  collateral          Collateral[]
  
  createdAt           DateTime @default(now())
  
  @@unique([workPackageId, workPackagePhaseId, deliverableLabel]) // For idempotent upsert
  @@index([workPackageId])
  @@index([workPackagePhaseId])
  @@index([deliverableType])
  @@index([status])
  @@map("work_package_items")
}
```

**Migration Strategy:**
- Add `estimatedHoursEach` as new field
- Keep `duration` for backward compatibility (can be deprecated later)
- Add computed field: `totalEstimatedHours = quantity * estimatedHoursEach`

---

## 🔄 Field Mapping (CSV → Database)

| CSV Field | Database Field | Model | Notes |
|-----------|---------------|-------|-------|
| `proposalDescription` | `description` | WorkPackage | From first row only |
| `proposalTotalCost` | `totalCost` | WorkPackage | From first row only |
| `proposalNotes` | (metadata) | WorkPackage | Store in notes field or skip |
| `phaseName` | `name` | WorkPackagePhase | Upsert key |
| `phasePosition` | `position` | WorkPackagePhase | Upsert key |
| `phaseDescription` | `description` | WorkPackagePhase | NEW field |
| `deliverableLabel` | `deliverableLabel` | WorkPackageItem | Upsert key |
| `deliverableType` | `deliverableType` | WorkPackageItem | NEW field |
| `deliverableDescription` | `deliverableDescription` | WorkPackageItem | NEW field |
| `quantity` | `quantity` | WorkPackageItem | |
| `unitOfMeasure` | `unitOfMeasure` | WorkPackageItem | |
| `estimatedHoursEach` | `estimatedHoursEach` | WorkPackageItem | NEW field |
| `status` | `status` | WorkPackageItem | Standardize values |

---

## ✅ Recommended Refactors

### 1. WorkPackage - Add Missing Fields
- ✅ Add `title` (String, required)
- ✅ Add `description` (String?, optional)
- ✅ Add `totalCost` (Float?, optional)
- ✅ Add `effectiveStartDate` (DateTime?, optional)
- ✅ Add index on `companyId` for queries

### 2. WorkPackagePhase - Add Missing Fields
- ✅ Add `description` (String?, optional)
- ✅ Add `totalEstimatedHours` (Int?, computed)
- ✅ Add unique constraint on `[workPackageId, name, position]` for idempotent upsert

### 3. WorkPackageItem - Align Field Names
- ✅ Add `deliverableType` (alias for `itemType` - keep both for compatibility)
- ✅ Add `deliverableLabel` (alias for `itemLabel` - keep both)
- ✅ Add `deliverableDescription` (alias for `itemDescription` - keep both)
- ✅ Add `estimatedHoursEach` (Int, required)
- ✅ Keep `duration` for backward compatibility (deprecate later)
- ✅ Standardize `status` default to "not_started"
- ✅ Add unique constraint on `[workPackageId, workPackagePhaseId, deliverableLabel]` for idempotent upsert

### 4. Computed Fields (Application Logic)
- `WorkPackageItem.totalEstimatedHours = quantity * estimatedHoursEach`
- `WorkPackagePhase.totalEstimatedHours = SUM(items.totalEstimatedHours)`
- `WorkPackage.totalEstimatedHours = SUM(phases.totalEstimatedHours)`

---

## 🚨 Migration Considerations

### Backward Compatibility
- Keep existing fields (`itemType`, `itemLabel`, `itemDescription`, `duration`)
- Add new fields alongside old ones
- Use application logic to sync old → new fields during migration
- Deprecate old fields in future migration

### Idempotent Upsert Keys
- **WorkPackagePhase**: `[workPackageId, name, position]`
- **WorkPackageItem**: `[workPackageId, workPackagePhaseId, deliverableLabel]`

### Data Migration
- Existing `WorkPackageItem.duration` → `estimatedHoursEach` (1:1 mapping, may need conversion)
- Existing `WorkPackagePhase.phaseTotalDuration` → keep for backward compatibility
- Compute `totalEstimatedHours` from items on first import

---

## 📝 Next Steps

1. ✅ Create Prisma migration with new fields
2. ✅ Build CSV parser with type guards
3. ✅ Build hydration service with upsert logic
4. ✅ Build API routes (one-shot + modular)
5. ✅ Test with provided CSV data

