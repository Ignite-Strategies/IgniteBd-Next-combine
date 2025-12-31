# Invoice Process Refactor Proposal

**Date:** 2025-01-28  
**Status:** Proposal  
**Goal:** Decouple invoices from `workPackageId` and move invoice configuration to company settings

---

## 📋 Executive Summary

The current invoice system is tightly coupled to `work_packages`, requiring a `workPackageId` for every invoice. This creates limitations:
- Invoices can only be created for existing work packages
- Cannot create standalone invoices for ad-hoc billing
- Invoice templates and settings are not company-scoped
- Difficult to manage billing independently of work execution

**Proposed Solution:** Move invoice configuration and templates to company settings (`company_hqs`), making invoices independent entities that can optionally reference work packages.

---

## 🔍 Current State Analysis

### Current Schema Structure

#### Invoice Model (Current)
```prisma
model invoices {
  id                      String               @id @default(cuid())
  workPackageId           String               // ⚠️ REQUIRED - Tight coupling
  invoiceName             String
  invoiceDescription      String?
  totalExpected           Int                  @default(0)
  totalReceived           Int                  @default(0)
  status                  String               @default("pending")
  createdAt               DateTime             @default(now())
  updatedAt               DateTime             @updatedAt
  invoiceNumber           String?
  amount                  Float?
  currency                String               @default("USD")
  paidAt                  DateTime?
  paidByContactId         String?
  stripeCheckoutSessionId String?
  stripePaymentIntentId   String?
  stripeCustomerId        String?
  invoice_milestones      invoice_milestones[]
  work_packages           work_packages        @relation(fields: [workPackageId], references: [id], onDelete: Cascade)
  payments                payments[]

  @@index([status])
  @@index([stripeCustomerId])
  @@index([workPackageId])  // ⚠️ Required index
}
```

**Key Issues:**
1. `workPackageId` is **required** (not nullable)
2. Foreign key constraint with `onDelete: Cascade` - deleting work package deletes invoice
3. No way to create invoices without a work package
4. Invoice templates are global, not company-scoped

#### Invoice Template Model (Current)
```prisma
model invoice_templates {
  id                          String                        @id @default(cuid())
  name                        String
  notes                       String?
  createdAt                   DateTime                      @default(now())
  updatedAt                   DateTime                      @updatedAt
  invoice_template_milestones invoice_template_milestones[]
  // ⚠️ No companyHQId - templates are global
}
```

**Key Issues:**
1. Templates are not scoped to companies
2. Cannot have company-specific billing templates
3. No way to manage default invoice settings per company

### Current API Implementation

#### Create Invoice Endpoint
**File:** `app/api/billing/invoices/create/route.ts`

```typescript
// Current implementation requires workPackageId
const { workPackageId, invoiceName, invoiceDescription, milestones } = body;

// Validation - REQUIRES workPackageId
if (!workPackageId) {
  return NextResponse.json(
    { success: false, error: 'workPackageId is required' },
    { status: 400 },
  );
}

// Creates invoice with required workPackageId
const invoice = await prisma.invoice.create({
  data: {
    workPackageId,  // ⚠️ Required
    invoiceName: invoiceName.trim(),
    // ...
  },
});
```

**Current Flow:**
1. User must select a work package
2. Invoice is created tied to that work package
3. Cannot create invoice without work package

### Current UI Implementation

#### Create Invoice Page
**File:** `app/(authenticated)/billing/invoices/create/page.jsx`

**Current Flow:**
1. Loads work packages from API/localStorage
2. User selects a work package (required)
3. Invoice is created with `workPackageId`

**Limitations:**
- Cannot create invoice without work package
- Work package selection is mandatory
- No option for standalone billing

---

## 🎯 Proposed Solution

### Option 1: Make `workPackageId` Optional (Recommended)

**Approach:** Keep invoices flexible - can be tied to work packages OR standalone.

#### Schema Changes

```prisma
model invoices {
  id                      String               @id @default(cuid())
  companyHQId             String               // ✅ NEW - Required company scope
  workPackageId           String?              // ✅ Changed to optional
  invoiceName             String
  invoiceDescription      String?
  
  // Client/Contact information (for standalone invoices)
  contactId               String?              // ✅ NEW - Optional contact reference
  companyId               String?              // ✅ NEW - Optional company reference
  
  totalExpected           Int                  @default(0)
  totalReceived           Int                  @default(0)
  status                  String               @default("pending")
  createdAt               DateTime             @default(now())
  updatedAt               DateTime             @updatedAt
  invoiceNumber           String?
  amount                  Float?
  currency                String               @default("USD")
  paidAt                  DateTime?
  paidByContactId         String?
  stripeCheckoutSessionId String?
  stripePaymentIntentId   String?
  stripeCustomerId        String?
  
  invoice_milestones      invoice_milestones[]
  work_packages           work_packages?       @relation(fields: [workPackageId], references: [id], onDelete: SetNull)  // ✅ Changed to SetNull
  company_hqs             company_hqs          @relation(fields: [companyHQId], references: [id], onDelete: Cascade)   // ✅ NEW
  contacts                Contact?             @relation(fields: [contactId], references: [id])                         // ✅ NEW
  companies               companies?            @relation(fields: [companyId], references: [id])                         // ✅ NEW
  payments                payments[]

  @@index([status])
  @@index([stripeCustomerId])
  @@index([workPackageId])
  @@index([companyHQId])      // ✅ NEW
  @@index([contactId])         // ✅ NEW
  @@index([companyId])         // ✅ NEW
}
```

#### Invoice Template Changes

```prisma
model invoice_templates {
  id                          String                        @id @default(cuid())
  companyHQId                 String                        // ✅ NEW - Company-scoped
  name                        String
  notes                       String?
  createdAt                   DateTime                      @default(now())
  updatedAt                   DateTime                      @updatedAt
  invoice_template_milestones invoice_template_milestones[]
  company_hqs                 company_hqs                   @relation(fields: [companyHQId], references: [id], onDelete: Cascade)

  @@unique([companyHQId, name])  // ✅ Unique per company
  @@index([companyHQId])
}
```

#### Company Settings Addition

Add invoice settings to `company_hqs` model:

```prisma
model company_hqs {
  // ... existing fields ...
  
  // ✅ NEW - Invoice Settings
  invoicePrefix              String?                        // e.g., "INV-2025-"
  invoiceNumberFormat        String?                        // e.g., "{prefix}{number:04d}"
  defaultInvoiceCurrency     String?         @default("USD")
  defaultPaymentTerms        String?                        // e.g., "Net 30", "Due on receipt"
  invoiceNotes               String?                        // Default notes for all invoices
  taxId                      String?                        // Tax ID for invoices
  billingAddress             String?                        // Billing address
  billingEmail               String?                        // Billing contact email
  
  // Relations
  invoices                   invoices[]                     // ✅ NEW
  invoice_templates          invoice_templates[]            // ✅ NEW
}
```

### Option 2: Separate Invoice Settings Table

**Alternative Approach:** Create a dedicated `invoice_settings` table for more flexibility.

```prisma
model invoice_settings {
  id                      String      @id @default(cuid())
  companyHQId             String      @unique
  invoicePrefix           String?
  invoiceNumberFormat     String?
  defaultCurrency         String      @default("USD")
  defaultPaymentTerms     String?
  defaultNotes            String?
  taxId                   String?
  billingAddress          String?
  billingEmail            String?
  autoGenerateNumber      Boolean     @default(true)
  nextInvoiceNumber       Int         @default(1)
  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt
  company_hqs             company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)

  @@index([companyHQId])
}
```

---

## 🔄 Migration Strategy

### Phase 1: Schema Migration

1. **Add new fields to `invoices` table:**
   ```sql
   ALTER TABLE invoices 
     ADD COLUMN "companyHQId" TEXT NOT NULL,
     ADD COLUMN "contactId" TEXT,
     ADD COLUMN "companyId" TEXT,
     ALTER COLUMN "workPackageId" DROP NOT NULL;
   ```

2. **Update foreign key constraints:**
   ```sql
   -- Add companyHQ relation
   ALTER TABLE invoices 
     ADD CONSTRAINT invoices_companyHQId_fkey 
     FOREIGN KEY ("companyHQId") REFERENCES company_hqs(id) ON DELETE CASCADE;
   
   -- Make workPackageId nullable and change onDelete behavior
   ALTER TABLE invoices 
     DROP CONSTRAINT invoices_workPackageId_fkey,
     ADD CONSTRAINT invoices_workPackageId_fkey 
     FOREIGN KEY ("workPackageId") REFERENCES work_packages(id) ON DELETE SET NULL;
   ```

3. **Add companyHQId to invoice_templates:**
   ```sql
   ALTER TABLE invoice_templates 
     ADD COLUMN "companyHQId" TEXT NOT NULL;
   ```

4. **Create invoice_settings table (if using Option 2):**
   ```sql
   CREATE TABLE invoice_settings (
     id TEXT PRIMARY KEY,
     "companyHQId" TEXT UNIQUE NOT NULL,
     "invoicePrefix" TEXT,
     "invoiceNumberFormat" TEXT,
     "defaultCurrency" TEXT DEFAULT 'USD',
     "defaultPaymentTerms" TEXT,
     "defaultNotes" TEXT,
     "taxId" TEXT,
     "billingAddress" TEXT,
     "billingEmail" TEXT,
     "autoGenerateNumber" BOOLEAN DEFAULT true,
     "nextInvoiceNumber" INTEGER DEFAULT 1,
     "createdAt" TIMESTAMP DEFAULT NOW(),
     "updatedAt" TIMESTAMP DEFAULT NOW(),
     CONSTRAINT invoice_settings_companyHQId_fkey 
       FOREIGN KEY ("companyHQId") REFERENCES company_hqs(id) ON DELETE CASCADE
   );
   ```

### Phase 2: Data Migration

1. **Backfill `companyHQId` for existing invoices:**
   ```sql
   UPDATE invoices 
   SET "companyHQId" = (
     SELECT "workPackageOwnerId" 
     FROM work_packages 
     WHERE work_packages.id = invoices."workPackageId"
   )
   WHERE "workPackageId" IS NOT NULL;
   ```

2. **Backfill `contactId` and `companyId` from work packages:**
   ```sql
   UPDATE invoices 
   SET 
     "contactId" = (
       SELECT "workPackageClientId" 
       FROM work_packages 
       WHERE work_packages.id = invoices."workPackageId"
     ),
     "companyId" = (
       SELECT "companyId" 
       FROM work_packages 
       WHERE work_packages.id = invoices."workPackageId"
     )
   WHERE "workPackageId" IS NOT NULL;
   ```

3. **Migrate invoice templates to company-scoped:**
   ```sql
   -- Assign templates to a default companyHQ (requires manual review)
   -- Or create company-specific templates
   ```

### Phase 3: API Updates

1. **Update Create Invoice Endpoint:**
   ```typescript
   // Make workPackageId optional
   const { companyHQId, workPackageId, contactId, companyId, invoiceName, milestones } = body;
   
   // Require companyHQId instead
   if (!companyHQId) {
     return NextResponse.json(
       { success: false, error: 'companyHQId is required' },
       { status: 400 },
     );
   }
   
   // workPackageId is now optional
   const invoice = await prisma.invoice.create({
     data: {
       companyHQId,  // ✅ Required
       workPackageId: workPackageId || null,  // ✅ Optional
       contactId: contactId || null,
       companyId: companyId || null,
       // ...
     },
   });
   ```

2. **Update Invoice List Endpoint:**
   ```typescript
   // Filter by companyHQId instead of workPackageId
   const invoices = await prisma.invoice.findMany({
     where: {
       companyHQId: userCompanyHQId,
       // Optional filters
       workPackageId: workPackageId || undefined,
       status: status || undefined,
     },
   });
   ```

### Phase 4: UI Updates

1. **Update Create Invoice Form:**
   - Make work package selection optional
   - Add contact/company selection for standalone invoices
   - Load invoice settings from companyHQ
   - Auto-generate invoice numbers using company settings

2. **Add Settings Page Section:**
   - Invoice prefix/number format
   - Default payment terms
   - Billing address/email
   - Tax ID
   - Default currency

---

## 📊 Comparison: Current vs Proposed

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Invoice Creation** | Requires work package | Can be standalone or tied to work package |
| **Company Scope** | No company scope | Company-scoped via `companyHQId` |
| **Templates** | Global | Company-scoped |
| **Settings** | None | Company-level invoice settings |
| **Flexibility** | Low - tied to work packages | High - independent billing |
| **Migration Complexity** | N/A | Medium - requires data migration |

---

## ✅ Benefits

1. **Flexibility:** Create invoices without work packages
2. **Company Scoping:** Templates and settings per company
3. **Better Organization:** Invoices organized by company
4. **Settings Management:** Centralized billing configuration
5. **Backward Compatibility:** Existing invoices remain valid
6. **Future-Proof:** Easier to add features like recurring invoices

---

## ⚠️ Considerations

1. **Data Migration:** Need to backfill `companyHQId` for existing invoices
2. **API Changes:** Breaking changes to create invoice endpoint
3. **UI Updates:** Form changes required
4. **Validation:** Need to ensure either `workPackageId` OR `contactId`/`companyId` is provided
5. **Permissions:** Ensure users can only create invoices for their company

---

## 🚀 Implementation Plan

### Step 1: Schema Updates
- [ ] Update Prisma schema
- [ ] Create migration files
- [ ] Test migration on dev database

### Step 2: Data Migration
- [ ] Backfill `companyHQId` for existing invoices
- [ ] Migrate templates to company-scoped
- [ ] Create default invoice settings for companies

### Step 3: API Updates
- [ ] Update create invoice endpoint
- [ ] Update list invoice endpoint
- [ ] Add invoice settings endpoints
- [ ] Update invoice template endpoints

### Step 4: UI Updates
- [ ] Update create invoice form
- [ ] Add settings page section
- [ ] Update invoice list to filter by company
- [ ] Add invoice number auto-generation

### Step 5: Testing
- [ ] Test standalone invoice creation
- [ ] Test work package-linked invoices
- [ ] Test company settings
- [ ] Test template management
- [ ] Test data migration

---

## 📝 Next Steps

1. Review and approve proposal
2. Choose between Option 1 (fields on company_hqs) or Option 2 (separate settings table)
3. Create detailed migration plan
4. Begin implementation

---

## 🔗 Related Documents

- `BILLING_SYSTEM_INVESTIGATION.md` - Current billing system analysis
- `CREATE_INVOICE_IMPLEMENTATION.md` - Current invoice creation flow
- `CLIENT_PORTAL_DATABASE_ARCHITECTURE.md` - Client portal architecture

