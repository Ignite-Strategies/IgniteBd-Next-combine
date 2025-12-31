# Invoice System Refactor - Platform-First Architecture

**Date:** 2025-01-28  
**Status:** Refactor Plan  
**Goal:** Migrate work package invoices and create new platform invoice system with types

---

## 📋 Executive Summary

Work packages are being deprecated in favor of a "get on the platform" model. We need to:
1. **Preserve existing work package invoices** - migrate them to a new structure
2. **Create new invoice system** - platform-scoped with invoice types
3. **Support new invoice types:** PlatformFee, MonthlyRecurring, Custom
4. **Simplified status:** Paid / Not Paid

---

## 🎯 New Invoice Architecture

### Invoice Types

```typescript
enum InvoiceType {
  PLATFORM_FEE        // Platform onboarding/access fee
  MONTHLY_RECURRING   // Monthly subscription/recurring charges
  CUSTOM              // One-off custom invoices
  WORK_PACKAGE        // Legacy - migrated from work packages
}
```

### Invoice Status

```typescript
enum InvoiceStatus {
  NOT_PAID    // Default - invoice created but not paid
  PAID        // Fully paid
  PARTIAL     // Partially paid (for multi-milestone invoices)
}
```

---

## 📊 Schema Design

### Previous Invoice Model (Before Refactor)

```prisma
// OLD MODEL - Before refactor
model invoices {
  id                      String               @id @default(cuid())
  workPackageId           String               // ❌ Required - tight coupling
  invoiceName             String
  invoiceDescription      String?
  totalExpected           Int                  @default(0)
  totalReceived           Int                  @default(0)
  status                  String               @default("pending")  // ❌ String, not enum
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
  work_packages           work_packages        @relation(fields: [workPackageId], references: [id], onDelete: Cascade)  // ❌ Cascade delete
  payments                payments[]

  @@index([status])
  @@index([stripeCustomerId])
  @@index([workPackageId])
}
```

**Key Issues:**
- ❌ `workPackageId` was required (not nullable)
- ❌ No `companyHQId` - not company-scoped
- ❌ No `invoiceType` - couldn't distinguish invoice types
- ❌ No `contactId` or `companyId` - couldn't create standalone invoices
- ❌ `status` was a String, not an enum
- ❌ No recurring invoice fields
- ❌ No `dueDate` field
- ❌ Foreign key constraint with `onDelete: Cascade` - deleting work package deleted invoice

### Current Invoice Model (Actual Schema)

```prisma
model invoices {
  id                      String               @id @default(cuid())
  
  // Company/Platform Scope
  companyHQId             String
  
  // Invoice Type & Classification
  invoiceType             InvoiceType
  invoiceName             String
  invoiceDescription      String?
  invoiceNumber           String?
  
  // Legacy Work Package Link (for migrated invoices)
  workPackageId           String?
  
  // Client/Contact Information
  contactId               String?
  companyId               String?
  
  // Amounts & Currency
  totalExpected           Int                  @default(0)
  totalReceived           Int                  @default(0)
  currency                String               @default("USD")
  amount                  Float?
  
  // Status
  status                  InvoiceStatus        @default(NOT_PAID)
  
  // Recurring Invoice Fields (for MONTHLY_RECURRING type)
  isRecurring             Boolean              @default(false)
  recurringFrequency      String?
  nextBillingDate         DateTime?
  lastBilledDate          DateTime?
  
  // Payment Tracking
  paidAt                  DateTime?
  paidByContactId         String?
  stripeCheckoutSessionId String?
  stripePaymentIntentId   String?
  stripeCustomerId        String?
  
  // Timestamps
  createdAt               DateTime             @default(now())
  updatedAt               DateTime             @updatedAt
  dueDate                 DateTime?
  
  // Relations
  invoice_milestones      invoice_milestones[]
  work_packages           work_packages?       @relation(fields: [workPackageId], references: [id], onDelete: SetNull)
  company_hqs             company_hqs          @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  contacts                Contact?             @relation(fields: [contactId], references: [id])
  companies               companies?           @relation(fields: [companyId], references: [id])
  payments                payments[]

  @@index([status])
  @@index([invoiceType])
  @@index([companyHQId])
  @@index([workPackageId])
  @@index([contactId])
  @@index([companyId])
  @@index([stripeCustomerId])
  @@index([isRecurring])
  @@index([nextBillingDate])
}
```

### Current Invoice Milestones Model (Actual Schema)

```prisma
model invoice_milestones {
  id             String     @id @default(cuid())
  invoiceId      String
  label          String
  expectedAmount Int
  expectedDate   DateTime?
  description    String?
  status         String     @default("pending")
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  invoices       invoices   @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  payments       payments[]

  @@index([invoiceId])
  @@index([status])
}
```

### Current Invoice Templates Model (Actual Schema)

```prisma
model invoice_templates {
  id                          String                        @id @default(cuid())
  companyHQId                 String
  name                        String
  notes                       String?
  createdAt                   DateTime                      @default(now())
  updatedAt                   DateTime                      @updatedAt
  invoice_template_milestones invoice_template_milestones[]
  company_hqs                 company_hqs                   @relation(fields: [companyHQId], references: [id], onDelete: Cascade)

  @@unique([companyHQId, name])
  @@index([companyHQId])
}
```

### Current Invoice Template Milestones Model (Actual Schema)

```prisma
model invoice_template_milestones {
  id                String            @id @default(cuid())
  templateId        String
  label             String
  expectedAmount    Float
  expectedDate      DateTime?
  description       String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  invoice_templates invoice_templates @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@index([templateId])
}
```

### Current Invoice Settings Model (Actual Schema)

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
  platformFeeAmount       Int?
  platformFeeDescription   String?
  monthlyRecurringAmount   Int?
  monthlyRecurringDescription String?
  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt
  company_hqs             company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)

  @@index([companyHQId])
}
```

### Current Enums (Actual Schema)

```prisma
enum InvoiceType {
  PLATFORM_FEE
  MONTHLY_RECURRING
  CUSTOM
  WORK_PACKAGE
}

enum InvoiceStatus {
  NOT_PAID
  PAID
  PARTIAL
}
```

---

## 🔄 Migration Strategy

### Phase 1: Schema Migration

#### Step 1: Add New Fields (Backward Compatible)

```sql
-- Add new fields as nullable first
ALTER TABLE invoices 
  ADD COLUMN "companyHQId" TEXT,
  ADD COLUMN "invoiceType" TEXT,
  ADD COLUMN "contactId" TEXT,
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "isRecurring" BOOLEAN DEFAULT false,
  ADD COLUMN "recurringFrequency" TEXT,
  ADD COLUMN "nextBillingDate" TIMESTAMP,
  ADD COLUMN "lastBilledDate" TIMESTAMP,
  ADD COLUMN "dueDate" TIMESTAMP;

-- Make workPackageId nullable
ALTER TABLE invoices 
  ALTER COLUMN "workPackageId" DROP NOT NULL;
```

#### Step 2: Migrate Existing Data

```sql
-- Backfill companyHQId from work packages
UPDATE invoices i
SET "companyHQId" = (
  SELECT wp."workPackageOwnerId" 
  FROM work_packages wp 
  WHERE wp.id = i."workPackageId"
)
WHERE "workPackageId" IS NOT NULL;

-- Set invoiceType for existing invoices
UPDATE invoices 
SET "invoiceType" = 'WORK_PACKAGE'
WHERE "workPackageId" IS NOT NULL;

-- Backfill contactId and companyId from work packages
UPDATE invoices i
SET 
  "contactId" = (
    SELECT wp."workPackageClientId" 
    FROM work_packages wp 
    WHERE wp.id = i."workPackageId"
  ),
  "companyId" = (
    SELECT wp."companyId" 
    FROM work_packages wp 
    WHERE wp.id = i."workPackageId"
  )
WHERE "workPackageId" IS NOT NULL;

-- Migrate status values
UPDATE invoices 
SET status = CASE 
  WHEN status = 'paid' THEN 'PAID'
  WHEN status = 'partial' OR status = 'partially_paid' THEN 'PARTIAL'
  ELSE 'NOT_PAID'
END;
```

#### Step 3: Add Constraints

```sql
-- Make companyHQId required
ALTER TABLE invoices 
  ALTER COLUMN "companyHQId" SET NOT NULL,
  ALTER COLUMN "invoiceType" SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE invoices 
  ADD CONSTRAINT invoices_companyHQId_fkey 
  FOREIGN KEY ("companyHQId") REFERENCES company_hqs(id) ON DELETE CASCADE,
  
  ADD CONSTRAINT invoices_contactId_fkey 
  FOREIGN KEY ("contactId") REFERENCES contacts(id) ON DELETE SET NULL,
  
  ADD CONSTRAINT invoices_companyId_fkey 
  FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE SET NULL;

-- Change workPackageId constraint to SetNull
ALTER TABLE invoices 
  DROP CONSTRAINT invoices_workPackageId_fkey,
  ADD CONSTRAINT invoices_workPackageId_fkey 
  FOREIGN KEY ("workPackageId") REFERENCES work_packages(id) ON DELETE SET NULL;

-- Add indexes
CREATE INDEX invoices_companyHQId_idx ON invoices("companyHQId");
CREATE INDEX invoices_invoiceType_idx ON invoices("invoiceType");
CREATE INDEX invoices_contactId_idx ON invoices("contactId");
CREATE INDEX invoices_companyId_idx ON invoices("companyId");
CREATE INDEX invoices_isRecurring_idx ON invoices("isRecurring");
CREATE INDEX invoices_nextBillingDate_idx ON invoices("nextBillingDate");
```

### Phase 2: Create Invoice Settings (Company-Level)

```prisma
model invoice_settings {
  id                      String      @id @default(cuid())
  companyHQId             String      @unique
  invoicePrefix           String?     // e.g., "INV-2025-"
  invoiceNumberFormat     String?     // e.g., "{prefix}{number:04d}"
  defaultCurrency         String      @default("USD")
  defaultPaymentTerms     String?     // e.g., "Net 30", "Due on receipt"
  defaultNotes            String?
  taxId                   String?
  billingAddress          String?
  billingEmail            String?
  autoGenerateNumber      Boolean     @default(true)
  nextInvoiceNumber       Int         @default(1)
  
  // Platform Fee Settings
  platformFeeAmount       Int?        // In cents
  platformFeeDescription   String?
  
  // Monthly Recurring Settings
  monthlyRecurringAmount   Int?        // In cents
  monthlyRecurringDescription String?
  
  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt
  company_hqs             company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)

  @@index([companyHQId])
}
```

---

## 🎨 Invoice Type Use Cases

### 1. Platform Fee (`PLATFORM_FEE`)

**Purpose:** One-time fee for platform access/onboarding

**Example:**
```typescript
{
  invoiceType: 'PLATFORM_FEE',
  invoiceName: 'Platform Onboarding Fee',
  totalExpected: 50000, // $500.00
  companyHQId: '...',
  contactId: '...',
  status: 'NOT_PAID',
  dueDate: '2025-02-15'
}
```

**Characteristics:**
- One-time charge
- Usually created when company joins platform
- Can be paid upfront or invoiced

### 2. Monthly Recurring (`MONTHLY_RECURRING`)

**Purpose:** Monthly subscription/recurring charges

**Example:**
```typescript
{
  invoiceType: 'MONTHLY_RECURRING',
  invoiceName: 'Monthly Platform Subscription - January 2025',
  totalExpected: 20000, // $200.00/month
  isRecurring: true,
  recurringFrequency: 'monthly',
  nextBillingDate: '2025-02-01',
  lastBilledDate: '2025-01-01',
  companyHQId: '...',
  status: 'PAID'
}
```

**Characteristics:**
- Auto-generated monthly
- Can have multiple milestones (e.g., base + usage)
- Tracks billing cycle

### 3. Custom (`CUSTOM`)

**Purpose:** One-off custom invoices for ad-hoc services

**Example:**
```typescript
{
  invoiceType: 'CUSTOM',
  invoiceName: 'Custom Consulting - Q1 Strategy',
  invoiceDescription: 'Strategic consulting services for Q1 planning',
  totalExpected: 150000, // $1,500.00
  companyHQId: '...',
  contactId: '...',
  status: 'NOT_PAID',
  dueDate: '2025-02-28',
  milestones: [
    { label: 'Initial Consultation', expectedAmount: 50000 },
    { label: 'Strategy Document', expectedAmount: 100000 }
  ]
}
```

**Characteristics:**
- Flexible - can have any description
- Can have multiple milestones
- One-time or recurring (if needed)

### 4. Work Package (`WORK_PACKAGE`)

**Purpose:** Legacy invoices migrated from work packages

**Example:**
```typescript
{
  invoiceType: 'WORK_PACKAGE',
  invoiceName: 'Work Package Invoice - Project Alpha',
  workPackageId: '...', // Legacy link preserved
  companyHQId: '...',
  contactId: '...',
  status: 'PARTIAL'
}
```

**Characteristics:**
- Preserves existing work package invoices
- Maintains link to work package for reference
- Read-only (no new work package invoices created)

---

## 🔧 API Changes

### Create Invoice Endpoint

**New Request Body:**
```typescript
POST /api/billing/invoices/create

{
  companyHQId: string (required)
  invoiceType: 'PLATFORM_FEE' | 'MONTHLY_RECURRING' | 'CUSTOM' (required)
  invoiceName: string (required)
  invoiceDescription?: string
  contactId?: string
  companyId?: string
  totalExpected: number (in cents)
  currency?: string (default: 'USD')
  dueDate?: string (ISO date)
  
  // For recurring invoices
  isRecurring?: boolean
  recurringFrequency?: 'monthly' | 'quarterly' | 'annually'
  nextBillingDate?: string
  
  // Milestones (optional)
  milestones?: Array<{
    label: string
    expectedAmount: number (in cents)
    expectedDate?: string
    description?: string
  }>
  
  // Legacy (deprecated - only for migration)
  workPackageId?: string
}
```

**Response:**
```typescript
{
  success: true,
  invoice: {
    id: string,
    invoiceType: InvoiceType,
    invoiceNumber: string, // Auto-generated
    status: InvoiceStatus,
    // ... other fields
  }
}
```

### List Invoices Endpoint

**Query Parameters:**
```typescript
GET /api/billing/invoices?companyHQId=...&invoiceType=...&status=...

// Filters:
- companyHQId (required)
- invoiceType?: PLATFORM_FEE | MONTHLY_RECURRING | CUSTOM | WORK_PACKAGE
- status?: NOT_PAID | PAID | PARTIAL
- isRecurring?: boolean
```

---

## 🎯 UI Changes

### Create Invoice Form

**New Flow:**
1. Select Invoice Type (Platform Fee / Monthly Recurring / Custom)
2. Select Company/Contact (from companyHQ)
3. Enter invoice details
4. Add milestones (optional)
5. Set due date
6. Submit

**Invoice Type Selection:**
- Platform Fee → Pre-fills amount from settings
- Monthly Recurring → Shows recurring options
- Custom → Full form

### Invoice List

**Filters:**
- Invoice Type
- Status (Paid / Not Paid / Partial)
- Recurring (Yes / No)
- Date Range

**Display:**
- Invoice Number
- Type Badge
- Client/Company
- Amount
- Status
- Due Date
- Actions

---

## 📋 Migration Checklist

### Schema Migration
- [ ] Add new fields to `invoices` table
- [ ] Create `invoice_settings` table
- [ ] Add enums (`InvoiceType`, `InvoiceStatus`)
- [ ] Update foreign key constraints
- [ ] Add indexes

### Data Migration
- [ ] Backfill `companyHQId` for existing invoices
- [ ] Set `invoiceType = 'WORK_PACKAGE'` for existing invoices
- [ ] Migrate status values to new enum
- [ ] Backfill `contactId` and `companyId`
- [ ] Create default invoice settings for companies

### API Updates
- [ ] Update create invoice endpoint
- [ ] Update list invoice endpoint
- [ ] Add invoice settings endpoints
- [ ] Update invoice detail endpoint
- [ ] Add recurring invoice generation job

### UI Updates
- [ ] Update create invoice form
- [ ] Add invoice type selector
- [ ] Update invoice list with filters
- [ ] Add settings page for invoice configuration
- [ ] Add recurring invoice management

### Testing
- [ ] Test platform fee invoice creation
- [ ] Test monthly recurring invoice creation
- [ ] Test custom invoice creation
- [ ] Test work package invoice migration
- [ ] Test recurring invoice auto-generation
- [ ] Test payment processing

---

## 🚀 Implementation Priority

1. **Phase 1:** Schema migration + data migration (preserve existing invoices)
2. **Phase 2:** New invoice types (Platform Fee, Custom)
3. **Phase 3:** Monthly Recurring invoices
4. **Phase 4:** Invoice settings UI
5. **Phase 5:** Recurring invoice automation

---

## 📝 Notes

- **Work Package Invoices:** Preserved as `WORK_PACKAGE` type, read-only
- **Backward Compatibility:** Existing invoices remain functional
- **Company Scoping:** All invoices are company-scoped via `companyHQId`
- **Settings:** Invoice configuration lives in company settings
- **Recurring:** Monthly recurring invoices can be auto-generated

---

## 🔗 Related Documents

- `INVOICE_REFACTOR_PROPOSAL.md` - Original proposal (superseded)
- `BILLING_SYSTEM_INVESTIGATION.md` - Current billing system analysis
- `CREATE_INVOICE_IMPLEMENTATION.md` - Current invoice creation flow

