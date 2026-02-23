# Ledger System - Simple Start Plan

## Philosophy

Start simple. Add complexity as needed. No over-engineering.

**Core Principle**: When you see an expense, you think "what should we call it?" - so let's make it easy to categorize inline.

## Phase 1: Minimal Viable Ledger

### Database Schema (Simplified)

```prisma
// Top-level financial container
model financials {
  id          String   @id @default(cuid())
  companyHQId String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  company_hqs company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  expenses    expenses[]
  income      income[]
  equity      equity[]
  
  @@map("financials")
}

// Expenses - simple
model expenses {
  id            String   @id @default(cuid())
  financialsId  String
  date          DateTime
  amount        Int      // Amount in cents
  description   String
  category      String?  // Free-form category name (e.g., "Office Supplies", "Marketing")
  vendor        String?
  receiptUrl    String?
  
  // CSV import tracking
  csvImportId   String?
  csvRowNumber  Int?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  financials    financials @relation(fields: [financialsId], references: [id], onDelete: Cascade)
  csv_imports   csv_imports? @relation(fields: [csvImportId], references: [id])
  
  @@index([financialsId])
  @@index([date])
  @@index([category])
  @@map("expenses")
}

// Income - simple
model income {
  id            String   @id @default(cuid())
  financialsId  String
  date          DateTime
  amount        Int      // Amount in cents
  description   String
  category      String?  // Free-form category name (e.g., "Service Revenue", "Stripe Payments")
  source        String?  // Where it came from (e.g., "Stripe", "Invoice #123")
  
  // Stripe integration
  stripePaymentIntentId String? @unique
  stripeInvoiceId      String?
  invoiceId            String? // FK to invoices
  
  // CSV import tracking
  csvImportId   String?
  csvRowNumber  Int?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  financials    financials @relation(fields: [financialsId], references: [id], onDelete: Cascade)
  invoices      invoices? @relation(fields: [invoiceId], references: [id])
  csv_imports   csv_imports? @relation(fields: [csvImportId], references: [id])
  
  @@index([financialsId])
  @@index([date])
  @@index([category])
  @@index([stripePaymentIntentId])
  @@map("income")
}

// Equity - simple
model equity {
  id            String   @id @default(cuid())
  financialsId  String
  date          DateTime
  amount        Int      // Amount in cents
  description   String
  category      String?  // Free-form category name (e.g., "Owner Investment", "Retained Earnings")
  source        String?
  
  // CSV import tracking
  csvImportId   String?
  csvRowNumber  Int?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  financials    financials @relation(fields: [financialsId], references: [id], onDelete: Cascade)
  csv_imports   csv_imports? @relation(fields: [csvImportId], references: [id])
  
  @@index([financialsId])
  @@index([date])
  @@index([category])
  @@map("equity")
}

// CSV imports - track what was imported
model csv_imports {
  id            String   @id @default(cuid())
  financialsId  String
  fileName      String
  fileUrl       String
  rowCount      Int
  importedCount Int      @default(0)
  status        ImportStatus @default(PENDING)
  columnMapping Json?    // Column mapping config
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  financials    financials @relation(fields: [financialsId], references: [id], onDelete: Cascade)
  expenses      expenses[]
  income        income[]
  equity        equity[]
  
  @@index([financialsId])
  @@map("csv_imports")
}

enum ImportStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

### Update Existing Models

```prisma
model company_hqs {
  // ... existing fields ...
  financials    financials?
}

model invoices {
  // ... existing fields ...
  income        income[]
}
```

## Phase 1 Features

### 1. CSV Import (`/financials/import`)

**Simple CSV Import Flow:**
1. Upload CSV file
2. Preview rows (first 10)
3. Map columns (date, description, amount)
4. Import all rows as expenses or income
5. Done

**CSV Format:**
```csv
Date,Description,Amount
2025-01-15,Office Supplies,-50.00
2025-01-16,Payment from Client,1000.00
```

**Import Logic:**
- Negative amounts → Expenses
- Positive amounts → Income
- Or user selects "Import as Expenses" or "Import as Income"

### 2. Expense List (`/financials/expenses`)

**Simple List View:**
- Date
- Description
- Amount
- Category (editable inline)
- Vendor
- Actions (Edit, Delete)

**Inline Category Editing:**
- Click category → Type new category or select from existing
- Auto-suggest existing categories as you type
- Create new category on-the-fly

### 3. Income List (`/financials/income`)

**Same as Expenses:**
- Date
- Description
- Amount
- Category (editable inline)
- Source
- Actions (Edit, Delete)

### 4. Quick Add (`/financials/expenses/new` or `/financials/income/new`)

**Simple Form:**
- Date (default: today)
- Amount
- Description
- Category (type or select)
- Vendor/Source
- Receipt upload (optional)

**Category Autocomplete:**
- As you type, show existing categories
- Create new if doesn't exist
- No predefined chart of accounts needed

### 5. Dashboard (`/financials`)

**Simple Overview:**
- Total Expenses (this month)
- Total Income (this month)
- Net (Income - Expenses)
- Recent transactions (last 10)
- Quick Add buttons

## Implementation

### Step 1: Database Schema
- [ ] Create `financials` table (one per company)
- [ ] Create `expenses` table
- [ ] Create `income` table
- [ ] Create `csv_imports` table
- [ ] Add foreign keys

### Step 2: CSV Import
- [ ] Upload CSV file
- [ ] Parse CSV (use existing `parseCSV` utility)
- [ ] Preview rows
- [ ] Column mapping
- [ ] Import as expenses or income
- [ ] Show results

**API Routes:**
- `POST /api/financials/csv/upload` - Upload CSV
- `POST /api/financials/csv/preview` - Preview CSV
- `POST /api/financials/csv/import` - Import CSV

### Step 3: Expense/Income Lists
- [ ] List expenses with filters
- [ ] List income with filters
- [ ] Inline category editing
- [ ] Category autocomplete
- [ ] Edit/Delete actions

**API Routes:**
- `GET /api/financials/expenses` - List expenses
- `POST /api/financials/expenses` - Create expense
- `PUT /api/financials/expenses/[id]` - Update expense
- `DELETE /api/financials/expenses/[id]` - Delete expense
- `GET /api/financials/income` - List income
- `POST /api/financials/income` - Create income
- `PUT /api/financials/income/[id]` - Update income
- `DELETE /api/financials/income/[id]` - Delete income
- `GET /api/financials/categories` - Get all categories (for autocomplete)

### Step 4: Quick Add Forms
- [ ] Expense form
- [ ] Income form
- [ ] Category autocomplete
- [ ] Receipt upload

### Step 5: Dashboard
- [ ] Summary cards (expenses, income, net)
- [ ] Recent transactions
- [ ] Quick add buttons

## UI Components

### CSV Import Page
```
/financials/import

[Upload CSV File]
  Drag & drop or browse

[Preview]
  Date | Description | Amount | Type
  2025-01-15 | Office Supplies | -50.00 | Expense
  2025-01-16 | Payment | 1000.00 | Income

[Import Options]
  ☐ Import negative amounts as Expenses
  ☐ Import positive amounts as Income
  [Import] [Cancel]
```

### Expense List Page
```
/financials/expenses

[Filters] [Add Expense]

Date       | Description        | Amount | Category          | Actions
2025-01-15 | Office Supplies    | $50.00 | Office Supplies   | [Edit] [Delete]
2025-01-16 | Marketing Ad       | $200.00| Marketing         | [Edit] [Delete]
2025-01-17 | Coffee Meeting     | $25.00 | [Enter category...]| [Edit] [Delete]
```

**Inline Category Editing:**
- Click category → Input field appears
- Type to search existing categories
- Press Enter to save
- Creates new category if doesn't exist

### Quick Add Expense
```
/financials/expenses/new

Date: [2025-01-20]
Amount: [$50.00]
Description: [Office Supplies]
Category: [Office Supplies] ← autocomplete
Vendor: [Staples]
Receipt: [Upload]

[Save] [Cancel]
```

## Category Management

**No predefined categories needed!**

- Categories are created on-the-fly
- Just type a category name
- System tracks all unique categories
- Can merge/rename later if needed
- Simple list: "Office Supplies", "Marketing", "Travel", etc.

**Category API:**
- `GET /api/financials/categories?type=expense` - Get expense categories
- `GET /api/financials/categories?type=income` - Get income categories
- Returns: `["Office Supplies", "Marketing", "Travel", ...]`

## Stripe Integration (Later)

When Stripe webhook fires:
- Create `income` record automatically
- Set `stripePaymentIntentId`
- Link to `invoice` if applicable
- Category: "Stripe Payments" (or from invoice)

## Future Bolt-Ons

Once this works, we can add:
- Chart of Accounts (if needed)
- Double-entry bookkeeping (if needed)
- Bank reconciliation (if needed)
- Reports (P&L, etc.)
- Forecast logic (if needed)

But start simple. Get CSV import working. Get inline categorization working. Then iterate.

## Migration Strategy

1. Create `financials` record for each company (one-time)
2. Backfill expenses/income from existing invoices/payments (optional)
3. Start using CSV import
4. Add features as needed

## Success Criteria

- ✅ Can import CSV bank statements
- ✅ Can add expenses/income manually
- ✅ Can categorize inline (no setup needed)
- ✅ Can see simple dashboard
- ✅ Categories are free-form (no predefined list)

That's it. Keep it simple.
