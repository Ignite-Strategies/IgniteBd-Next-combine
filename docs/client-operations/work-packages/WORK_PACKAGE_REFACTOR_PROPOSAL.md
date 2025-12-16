# Work Package Model Refactor - Company-First Architecture

## 🎯 Goals

1. **Company-First**: Work packages belong to companies, not individual contacts
2. **Owner Model**: One contact is the "owner" of the work package
3. **Recipients**: Other company members can be recipients/participants
4. **Top Container**: WorkPackageId is the primary container
5. **Bolt-On Capability**: Extensible architecture for future features

## 📊 Current Model (Contact-First)

```prisma
model work_packages {
  id                  String                @id
  contactId           String                // ❌ Required - contact-first
  companyId           String?               // ❌ Optional - company-second
  title               String
  description         String?
  prioritySummary     String?
  totalCost           Float?
  effectiveStartDate  DateTime?
  createdAt           DateTime              @default(now())
  updatedAt           DateTime
  invoices            invoices[]
  work_package_items  work_package_items[]
  work_package_phases work_package_phases[]
  companies           companies?            @relation(fields: [companyId], references: [id])
  contacts            Contact               @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([contactId])
}
```

### Current Issues:
- ❌ `contactId` is required, `companyId` is optional
- ❌ No way to add multiple recipients from the same company
- ❌ Filtering by company requires joining through contacts
- ❌ Business logic suggests work packages are company-scoped

## 🚀 Proposed Model (Company-First)

```prisma
model work_packages {
  id                  String                @id
  companyId           String                // ✅ Required - company-first (was optional)
  ownerContactId      String                // ✅ Required - primary contact/owner (renamed from contactId)
  title               String
  description         String?
  prioritySummary     String?
  totalCost           Float?
  effectiveStartDate  DateTime?
  status              WorkPackageStatus    @default(ACTIVE)
  createdAt           DateTime              @default(now())
  updatedAt           DateTime
  
  // Relations
  companies           companies             @relation(fields: [companyId], references: [id], onDelete: Cascade)
  ownerContact        Contact               @relation("WorkPackageOwner", fields: [ownerContactId], references: [id], onDelete: Restrict)
  recipients          work_package_recipients[]
  invoices            invoices[]
  work_package_items  work_package_items[]
  work_package_phases work_package_phases[]
  
  // Bolt-on capabilities (extensible)
  metadata            Json?                 // For future extensibility
  tags                String[]               @default([])
  
  @@index([companyId])
  @@index([ownerContactId])
  @@index([status])
}

// New: Recipients table for company members
model work_package_recipients {
  id              String          @id @default(uuid())
  workPackageId   String
  contactId       String
  role            WorkPackageRecipientRole @default(VIEWER)
  addedAt         DateTime        @default(now())
  addedBy         String?         // Contact ID who added this recipient
  
  work_packages   work_packages   @relation(fields: [workPackageId], references: [id], onDelete: Cascade)
  contacts        Contact         @relation("WorkPackageRecipient", fields: [contactId], references: [id], onDelete: Cascade)
  
  @@unique([workPackageId, contactId])
  @@index([workPackageId])
  @@index([contactId])
}

enum WorkPackageRecipientRole {
  VIEWER      // Can view work package
  CONTRIBUTOR // Can contribute/update items
  APPROVER    // Can approve deliverables
  OWNER       // Full access (typically same as ownerContactId)
}
```

### Updated Contact Model Relations

```prisma
model Contact {
  // ... existing fields ...
  
  // Updated relations
  ownedWorkPackages    work_packages[]      @relation("WorkPackageOwner")
  recipientWorkPackages work_package_recipients[] @relation("WorkPackageRecipient")
  
  // Legacy relation (can be removed after migration)
  // work_packages        work_packages[]      // Remove after migration
}
```

### Updated Company Model Relations

```prisma
model companies {
  // ... existing fields ...
  
  work_packages         work_packages[]     // Now required relationship (was optional)
}
```

## 📋 Key Changes

### 1. Company-First Assignment
- ✅ `companyId` is **required** (not optional)
- ✅ `ownerContactId` replaces `contactId` (still required, but semantic change)
- ✅ Cascade delete: If company is deleted, work packages are deleted
- ✅ Restrict delete: Owner contact cannot be deleted if they own work packages

### 2. Recipients System
- ✅ New `work_package_recipients` table for multiple company members
- ✅ Role-based access (VIEWER, CONTRIBUTOR, APPROVER, OWNER)
- ✅ Tracks who added each recipient
- ✅ Unique constraint prevents duplicate recipients

### 3. Bolt-On Capabilities
- ✅ `metadata` JSON field for extensible data
- ✅ `tags` array for categorization
- ✅ `status` enum for lifecycle management
- ✅ Easy to add new fields without breaking existing code

### 4. Updated Contact Relations

```prisma
model Contact {
  // ... existing fields ...
  
  // Updated relations
  ownedWorkPackages    work_packages[]      @relation("WorkPackageOwner")
  recipientWorkPackages work_package_recipients[] @relation("WorkPackageRecipient")
}
```

### 5. Updated Company Relations

```prisma
model companies {
  // ... existing fields ...
  
  work_packages         work_packages[]     // Now required relationship
}
```

## 🔄 Migration Strategy

### Phase 1: Add New Fields (Non-Breaking)
1. Add `ownerContactId` field (nullable initially)
2. Add `work_package_recipients` table
3. Add `metadata`, `tags`, `status` fields
4. Keep `contactId` for backward compatibility

### Phase 2: Data Migration
1. Copy `contactId` → `ownerContactId` for all existing work packages
2. Auto-populate `companyId` from `ownerContactId.contactCompanyId` where missing
3. Create initial recipient entries (ownerContactId as OWNER role)

### Phase 3: Make Required (Breaking)
1. Make `companyId` required (non-nullable)
2. Make `ownerContactId` required (non-nullable)
3. Remove `contactId` field (or keep as computed/legacy)

## 📊 Query Examples

### Get all work packages for a company
```prisma
const workPackages = await prisma.workPackage.findMany({
  where: { companyId: 'company-123' },
  include: {
    ownerContact: true,
    recipients: {
      include: { contact: true }
    }
  }
});
```

### Get work packages where contact is owner or recipient
```prisma
const workPackages = await prisma.workPackage.findMany({
  where: {
        OR: [
          { ownerContactId: contactId },
          { recipients: { some: { contactId } } }
        ]
      }
});
```

### Add recipient to work package
```prisma
await prisma.workPackageRecipient.create({
  data: {
    workPackageId: 'wp-123',
    contactId: 'contact-456',
    role: 'CONTRIBUTOR',
    addedBy: currentUserId
  }
});
```

## ✅ Benefits

1. **Business Logic Alignment**: Work packages are company-scoped (matches real-world usage)
2. **Multi-User Support**: Multiple company members can access the same work package
3. **Role-Based Access**: Granular permissions per recipient
4. **Better Filtering**: Direct company queries (no joins needed)
5. **Extensibility**: JSON metadata and tags for future features
6. **Data Integrity**: Required companyId ensures all work packages have a company

## ⚠️ Breaking Changes

1. **API Changes**: 
   - `contactId` → `ownerContactId` in request/response
   - `companyId` becomes required (not optional)

2. **Query Changes**:
   - Filtering by company is now direct (not through contact)
   - Recipients require new table queries

3. **Client Portal**:
   - Access validation changes (company-based, not just contact-based)

## 📊 Comparison: Current vs Proposed

| Aspect | Current (Contact-First) | Proposed (Company-First) |
|--------|------------------------|-------------------------|
| **Primary Assignment** | `contactId` (required) | `companyId` (required) |
| **Owner** | `contactId` (implicit) | `ownerContactId` (explicit) |
| **Company** | `companyId` (optional) | `companyId` (required) |
| **Multiple Users** | ❌ Not supported | ✅ Via `work_package_recipients` |
| **Role-Based Access** | ❌ Not supported | ✅ VIEWER, CONTRIBUTOR, APPROVER, OWNER |
| **Filtering** | Join through contact | Direct company query |
| **Extensibility** | Limited | JSON metadata + tags |

## 🎯 Next Steps

1. **Review and approve this proposal**
2. **Create migration script**:
   - Add `ownerContactId` field (nullable initially)
   - Create `work_package_recipients` table
   - Migrate data: `contactId` → `ownerContactId`
   - Auto-populate `companyId` from contact's company
   - Create initial recipient entries
3. **Update API routes**:
   - Change `contactId` → `ownerContactId` in requests
   - Make `companyId` required
   - Add recipient management endpoints
4. **Update frontend components**:
   - ContactSelector → CompanySelector (primary)
   - Add recipient selection UI
   - Update work package creation flow
5. **Update client portal access logic**:
   - Validate access via company membership
   - Support recipient roles
6. **Test with existing data**:
   - Verify all work packages have companies
   - Test recipient functionality
   - Validate client portal access

## 🔍 Alignment Check

✅ **Company-First**: `companyId` is required, work packages belong to companies  
✅ **Owner Model**: `ownerContactId` explicitly defines the primary contact  
✅ **Recipients**: `work_package_recipients` table supports multiple company members  
✅ **Top Container**: `work_packages.id` remains the primary container  
✅ **Bolt-On Capability**: `metadata` JSON and `tags` array for extensibility
