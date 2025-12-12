# Billing System Investigation - IgniteBd

**Date:** 2025-01-28  
**Status:** Active System with Issues Found

---

## 📋 Executive Summary

IgniteBd has a **billing system** that includes invoice management, milestone tracking, payment records, and invoice templates. The system is **partially implemented** with several **field name mismatches** and **incomplete features** that need to be addressed.

**Key Findings:**
- ✅ Database models are defined and functional
- ✅ Basic UI exists (`/billing` page)
- ✅ API routes for CRUD operations exist
- ❌ Field name mismatches between frontend and backend
- ❌ Status value inconsistencies
- ❌ Missing payment processing implementation
- ❌ Create Invoice form is incomplete

---

## 🗄️ Database Schema

### Models Overview

Located in `prisma/schema.prisma` (lines 940-1025)

#### Invoice Model
```prisma
model Invoice {
  id                 String             @id @default(cuid())
  workPackageId      String
  workPackage        WorkPackage        @relation(...)
  invoiceName        String              // ⚠️ Frontend expects "invoiceNumber"
  invoiceDescription String?
  totalExpected      Int                @default(0)  // ⚠️ Frontend expects "totalAmount"
  totalReceived      Int                @default(0)
  status             String             @default("pending")  // ⚠️ Uses "partial" not "partially_paid"
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  milestones         InvoiceMilestone[]
  payments           Payment[]
}
```

**Relations:**
- `workPackage` → `WorkPackage` (many-to-one)
- `milestones` → `InvoiceMilestone[]` (one-to-many)
- `payments` → `Payment[]` (one-to-many)

#### InvoiceMilestone Model
```prisma
model InvoiceMilestone {
  id             String    @id @default(cuid())
  invoiceId      String
  invoice        Invoice   @relation(...)
  label          String
  expectedAmount Int
  expectedDate   DateTime?
  description    String?
  status         String    @default("pending")  // "pending" | "paid"
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  payments       Payment[] @relation("PaymentMilestone")
}
```

#### Payment Model
```prisma
model Payment {
  id                    String            @id @default(cuid())
  invoiceId             String
  invoice               Invoice           @relation(...)
  milestoneId           String?
  milestone             InvoiceMilestone? @relation("PaymentMilestone", ...)
  amountReceived        Int
  currency              String            @default("USD")
  paidAt                DateTime
  stripeSessionId       String?           @unique  // ⚠️ Stripe integration fields exist but unused
  stripePaymentIntentId String?           @unique
  paidByContactId       String?
  createdAt             DateTime          @default(now())
}
```

**Note:** Stripe fields (`stripeSessionId`, `stripePaymentIntentId`) are defined but **no payment processing code exists**.

#### InvoiceTemplate Model
```prisma
model InvoiceTemplate {
  id         String                     @id @default(cuid())
  name       String
  notes      String?
  milestones InvoiceTemplateMilestone[]
  createdAt  DateTime                   @default(now())
  updatedAt  DateTime                   @updatedAt
}
```

---

## 🎨 Frontend Implementation

### Billing Page
**Location:** `src/app/(authenticated)/billing/page.jsx`

**Features:**
- ✅ Three tabs: View Invoices, Create Invoice, Templates
- ✅ Search functionality (by invoice number, client name, company)
- ✅ Status filtering (all, pending, partially_paid, paid)
- ✅ Invoice list display with columns:
  - Invoice #
  - Client / Company
  - Total Amount
  - Outstanding
  - Status
  - Last Payment
  - Actions

**Issues Found:**

1. **Field Access Errors:**
   ```jsx
   // Line 243: Uses invoiceNumber (doesn't exist)
   {invoice.invoiceNumber || 'N/A'}
   
   // Line 248: Accesses invoice.contact directly (should be invoice.workPackage.contact)
   {invoice.contact?.firstName} {invoice.contact?.lastName}
   
   // Line 251: Accesses invoice.contactCompany directly (should be invoice.workPackage.company)
   {invoice.contactCompany?.companyName}
   
   // Line 256: Uses totalAmount (should be totalExpected)
   {formatCurrency(invoice.totalAmount)}
   ```

2. **Create Invoice Tab:**
   - Currently shows placeholder text: "Create Invoice form will be implemented here..."
   - No actual form implementation

3. **Templates Tab:**
   - Lists templates but "Use Template" button doesn't do anything
   - Upload CSV button exists but functionality unclear

---

## 🔌 API Routes

### Main Billing Route
**Location:** `src/app/api/admin/billing/route.js`

#### GET `/api/admin/billing`
**Purpose:** List all invoices with derived status

**Query Parameters:**
- `workPackageId` (optional) - Filter by work package
- `status` (optional) - Filter by status
- `search` (optional) - Search by invoice name or client name

**Response:**
```json
{
  "success": true,
  "invoices": [
    {
      "id": "...",
      "invoiceName": "...",
      "totalExpected": 10000,
      "totalReceived": 5000,
      "status": "pending",
      "outstandingAmount": 5000,
      "lastPaymentDate": null,
      "workPackage": {
        "contact": { "firstName": "...", "lastName": "..." },
        "company": { "companyName": "..." }
      },
      "milestones": [...],
      "payments": [...]
    }
  ]
}
```

**Issues:**
- ✅ Correctly accesses `workPackage.contact` and `workPackage.company`
- ⚠️ Status is stored in DB but comment says "Status is stored in DB, not derived" (inconsistent with utility functions)

#### POST `/api/admin/billing`
**Purpose:** Create invoice container (milestones added separately)

**Request Body:**
```json
{
  "workPackageId": "required",
  "invoiceName": "required",
  "invoiceDescription": "optional"
}
```

**Response:**
```json
{
  "success": true,
  "invoice": { ... }
}
```

**Notes:**
- Creates invoice with `totalExpected: 0` and `totalReceived: 0`
- Milestones must be added separately via CSV or UI

---

### Invoice Detail Route
**Location:** `src/app/api/admin/billing/[invoiceId]/route.js`

#### GET `/api/admin/billing/[invoiceId]`
**Purpose:** Get invoice details with milestones and payments

**Issues Found:**
```javascript
// Lines 32-46: Tries to access invoice.contact and invoice.contactCompany directly
// These don't exist - should be invoice.workPackage.contact and invoice.workPackage.company
include: {
  contact: { ... },        // ❌ WRONG - Invoice doesn't have contact relation
  contactCompany: { ... },  // ❌ WRONG - Invoice doesn't have contactCompany relation
  ...
}
```

#### PUT `/api/admin/billing/[invoiceId]`
**Purpose:** Update invoice container

**Request Body:**
```json
{
  "invoiceNumber": "...",  // ⚠️ Field doesn't exist in schema (should be invoiceName)
  "totalAmount": 10000,     // ⚠️ Field doesn't exist in schema (should be totalExpected)
  "description": "...",
  "dueDate": "..."
}
```

**Issues:**
- Tries to update `invoiceNumber` and `totalAmount` which don't exist in schema
- Should use `invoiceName` and `totalExpected` instead

---

### Milestone CSV Import Route
**Location:** `src/app/api/admin/billing/[invoiceId]/milestones/csv/route.js`

#### POST `/api/admin/billing/[invoiceId]/milestones/csv`
**Purpose:** Import milestones from CSV

**CSV Format:**
```csv
label,expectedAmount,expectedDate,description
Milestone 1,5000,2025-02-01,First payment
Milestone 2,5000,2025-03-01,Second payment
```

**Features:**
- ✅ Validates CSV format
- ✅ Creates milestones in transaction
- ✅ Recalculates `totalExpected` from milestones
- ✅ Updates invoice totals

**Status Calculation:**
```javascript
// Lines 207-214: Uses "partial" instead of "partially_paid"
if (totalReceived === 0) {
  status = 'pending';
} else if (totalReceived < totalExpected) {
  status = 'partial';  // ⚠️ Should be "partially_paid"
} else if (totalReceived >= totalExpected) {
  status = 'paid';
}
```

---

### Milestone Update Route
**Location:** `src/app/api/admin/billing/[invoiceId]/milestones/route.js`

#### PUT `/api/admin/billing/[invoiceId]/milestones`
**Purpose:** Update milestones for an invoice (replace all)

**Request Body:**
```json
{
  "milestones": [
    {
      "label": "...",
      "expectedAmount": 5000,
      "expectedDate": "...",
      "description": "..."
    }
  ]
}
```

---

### Template Routes
**Location:** `src/app/api/admin/billing/template/`

#### GET `/api/admin/billing/template`
**Purpose:** List all invoice templates

#### POST `/api/admin/billing/template`
**Purpose:** Create invoice template (from scratch or clone from invoice)

**Request Body:**
```json
{
  "name": "Template Name",
  "notes": "...",
  "milestones": [...],
  "fromInvoiceId": "optional"  // Clone from existing invoice
}
```

#### POST `/api/admin/billing/template/csv`
**Purpose:** Import template from CSV

---

## 🛠️ Utility Functions

### Invoice Status Helper
**Location:** `src/lib/utils/invoiceStatus.js`

**Functions:**
- `getInvoiceStatus(invoice, payments)` - Derives status from payments
- `getOutstandingAmount(invoice, payments)` - Calculates outstanding amount
- `getLastPaymentDate(payments)` - Gets last payment date

**Issues:**

1. **Field Name Mismatch:**
   ```javascript
   // Lines 19, 32, 47: Uses invoice.totalAmount
   if (!invoice || !invoice.totalAmount) { ... }
   if (totalPaid < invoice.totalAmount) { ... }
   return Math.max(0, invoice.totalAmount - totalPaid);
   
   // ⚠️ Schema uses totalExpected, not totalAmount
   ```

2. **Status Values:**
   - Utility functions expect: `"pending" | "partially_paid" | "paid"`
   - Schema uses: `"pending" | "partial" | "paid"`
   - **Inconsistency!**

3. **Payment Status Filter:**
   ```javascript
   // Lines 24-26: Filters by payment.status === 'paid'
   const totalPaid = payments
     .filter((p) => p.status === 'paid')  // ⚠️ Payment model doesn't have status field!
     .reduce((sum, p) => sum + (p.amountReceived || 0), 0);
   ```
   **Problem:** `Payment` model doesn't have a `status` field - all payments are considered paid.

---

## 🐛 Critical Issues Summary

### 1. Field Name Mismatches

| Frontend/API Expects | Schema Actually Has | Location |
|---------------------|---------------------|----------|
| `invoice.invoiceNumber` | `invoice.invoiceName` | billing/page.jsx:243, route.js:135 |
| `invoice.totalAmount` | `invoice.totalExpected` | billing/page.jsx:256, invoiceStatus.js |
| `invoice.contact` | `invoice.workPackage.contact` | billing/page.jsx:248, route.js:32 |
| `invoice.contactCompany` | `invoice.workPackage.company` | billing/page.jsx:251, route.js:41 |

### 2. Status Value Inconsistencies

| Location | Uses | Should Be |
|----------|------|-----------|
| Schema | `"pending" \| "partial" \| "paid"` | `"pending" \| "partially_paid" \| "paid"` |
| CSV import route | `"partial"` | `"partially_paid"` |
| Utility functions | `"partially_paid"` | ✅ Correct |
| Frontend | `"partially_paid"` | ✅ Correct |

### 3. Missing Payment Processing

- ✅ Stripe fields exist in schema (`stripeSessionId`, `stripePaymentIntentId`)
- ❌ No API routes to create payments
- ❌ No Stripe webhook handlers
- ❌ No payment processing UI
- ❌ No integration with Stripe SDK

### 4. Incomplete Features

- ❌ Create Invoice form is just a placeholder
- ❌ No way to manually create milestones via UI
- ❌ No payment creation UI
- ❌ Template "Use Template" button doesn't work
- ❌ No invoice PDF generation
- ❌ No email sending functionality

### 5. Logic Errors

- `invoiceStatus.js` filters payments by `payment.status === 'paid'` but Payment model has no status field
- `invoiceStatus.js` uses `invoice.totalAmount` but schema has `totalExpected`
- Some routes try to access `invoice.contact` directly instead of `invoice.workPackage.contact`

---

## 📊 Data Flow

### Current Flow (Broken)
```
1. Create Invoice → POST /api/admin/billing
   - Creates invoice with totalExpected: 0
   
2. Add Milestones → POST /api/admin/billing/[id]/milestones/csv
   - Updates totalExpected from milestones
   
3. View Invoices → GET /api/admin/billing
   - ❌ Frontend tries to access wrong fields
   - ❌ Status values don't match
   
4. Create Payment → ❌ DOESN'T EXIST
```

### Intended Flow (Based on Schema)
```
1. Create Invoice → Links to WorkPackage
2. Add Milestones → Define payment schedule
3. Record Payments → Link to Invoice and optionally Milestone
4. Calculate Status → From payments vs totalExpected
5. Track Stripe → Store session/payment intent IDs
```

---

## 🔧 Recommended Fixes

### Priority 1: Critical Field Fixes

1. **Fix Frontend Field Access:**
   ```jsx
   // billing/page.jsx
   - invoice.invoiceNumber → invoice.invoiceName
   - invoice.totalAmount → invoice.totalExpected
   - invoice.contact → invoice.workPackage.contact
   - invoice.contactCompany → invoice.workPackage.company
   ```

2. **Fix API Route Field Access:**
   ```javascript
   // route.js [invoiceId]
   - Remove contact and contactCompany from include
   - Access via workPackage relation
   ```

3. **Fix Utility Functions:**
   ```javascript
   // invoiceStatus.js
   - invoice.totalAmount → invoice.totalExpected
   - Remove payment.status filter (Payment has no status)
   ```

### Priority 2: Status Value Standardization

**Option A:** Update schema to use `"partially_paid"`
```prisma
status String @default("pending") // "pending" | "partially_paid" | "paid"
```

**Option B:** Update all code to use `"partial"`

**Recommendation:** Use `"partially_paid"` (more descriptive, matches frontend)

### Priority 3: Implement Payment Processing

1. **Create Payment API Route:**
   ```
   POST /api/admin/billing/[invoiceId]/payments
   ```

2. **Stripe Integration:**
   - Create Stripe checkout session
   - Handle webhook events
   - Update payment records

3. **Payment UI:**
   - Add payment form to invoice detail page
   - Show payment history
   - Link to Stripe checkout

### Priority 4: Complete Create Invoice Form

1. Work Package selector
2. Invoice name/description fields
3. Milestone builder (add/edit/delete milestones)
4. Save button

---

## 📁 File Locations

### Database
- `prisma/schema.prisma` (lines 940-1025)

### Frontend
- `src/app/(authenticated)/billing/page.jsx`
- `src/components/Sidebar.jsx` (line 86 - billing menu item)

### Backend API
- `src/app/api/admin/billing/route.js`
- `src/app/api/admin/billing/[invoiceId]/route.js`
- `src/app/api/admin/billing/[invoiceId]/milestones/route.js`
- `src/app/api/admin/billing/[invoiceId]/milestones/csv/route.js`
- `src/app/api/admin/billing/template/route.js`
- `src/app/api/admin/billing/template/csv/route.js`

### Utilities
- `src/lib/utils/invoiceStatus.js`

---

## 🧪 Testing Checklist

- [ ] Create invoice via API
- [ ] Add milestones via CSV
- [ ] View invoices list (check field access)
- [ ] Filter by status
- [ ] Search invoices
- [ ] Get invoice details
- [ ] Update invoice
- [ ] Create payment (when implemented)
- [ ] Status calculation accuracy
- [ ] Outstanding amount calculation

---

## 📝 Notes

- Billing system is linked to `WorkPackage` model
- WorkPackage links to `Contact` and `Company`
- No direct invoice-to-contact relationship (goes through WorkPackage)
- Stripe integration is prepared (fields exist) but not implemented
- Template system exists but usage unclear

---

**Last Updated:** 2025-01-28  
**Investigated By:** AI Assistant

