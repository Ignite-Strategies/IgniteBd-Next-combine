# Ledger System - UX Architecture

## Overview

The ledger system is split into **two separate UX areas** within the platform:

1. **Tune Financial Engine** - Configuration and setup
2. **Financials** - Operational source of truth

This separation ensures configuration is distinct from day-to-day financial operations.

---

## 1. Tune Financial Engine

**Purpose**: Configure the financial system before use

**Route**: `/settings/financial-engine` or `/platform/financial-engine`

### Features

#### 1.1 Chart of Accounts Management
- **View/Edit Chart of Accounts**
  - Table view: Account Number, Account Name, Type, Status
  - Filter by account type
  - Search functionality
  - Hierarchical view (parent/child accounts)
  
- **Create/Edit Account**
  - Account Number (required, unique)
  - Account Name (required)
  - Account Type (Income, Expense, COGS, Asset, Liability, Equity)
  - Parent Account (optional)
  - Description
  - Active/Inactive toggle

- **Account Templates**
  - Load default templates
  - Import from CSV
  - Export current chart

#### 1.2 Forecast Logic Configuration
- **Forecast Rules**
  - Set forecast periods (monthly, quarterly, yearly)
  - Define forecast methods (linear, growth %, historical average)
  - Set forecast accounts (which accounts to forecast)
  
- **Forecast Templates**
  - Create forecast scenarios
  - Set growth rates by account type
  - Define seasonality patterns

- **Forecast Settings**
  - Default forecast horizon (e.g., 12 months)
  - Confidence intervals
  - Forecast refresh frequency

#### 1.3 Setup Engine Configuration
- **Initial Setup Wizard**
  - Step 1: Chart of Accounts (load template or create custom)
  - Step 2: Forecast Logic (configure forecasting)
  - Step 3: Bank Accounts (add bank accounts)
  - Step 4: Starting Balances (set initial balances)
  - Step 5: Review & Complete

- **System Settings**
  - Fiscal year start date
  - Default currency
  - Accounting method (cash vs accrual)
  - Number format preferences

### UI Components

```
Tune Financial Engine
├── Chart of Accounts
│   ├── Account List (table)
│   ├── Create Account (modal/form)
│   ├── Edit Account (modal/form)
│   ├── Account Templates (dropdown)
│   └── Import/Export (buttons)
├── Forecast Logic
│   ├── Forecast Rules (form)
│   ├── Forecast Templates (list)
│   └── Forecast Settings (form)
└── Setup Engine
    ├── Setup Wizard (multi-step)
    └── System Settings (form)
```

### Access Control
- **Admin Only**: Only platform admins/accounting admins can access
- **One-Time Setup**: Can be locked after initial setup (optional)
- **Audit Trail**: Track all configuration changes

---

## 2. Financials

**Purpose**: Operational financial data - the source of truth

**Route**: `/financials` or `/accounting/financials`

### Features

#### 2.1 Bank Setup & Starting Balances
- **Bank Account Management**
  - Add bank accounts
  - Set account name, type (checking, savings, etc.)
  - Set starting balance
  - Set starting date (when to begin tracking)
  - Link to Stripe account (if applicable)

- **Starting Balance Entry**
  - Date picker (starting date)
  - Account selection (which bank account)
  - Starting balance amount
  - Notes/description
  - Create opening balance transaction

**Setup Flow:**
```
1. Add Bank Account
   - Name: "Business Checking"
   - Type: Checking
   - Account Number: (optional, masked)
   
2. Set Starting Balance
   - Date: 2025-01-01
   - Balance: $10,000.00
   - Creates opening balance entry in ledger
```

#### 2.2 CSV Bank Statement Import
- **Import Interface**
  - Upload CSV file
  - Preview/Map columns
  - Select bank account
  - Set date range
  - Import transactions

- **CSV Format Support**
  - Standard formats (Chase, Bank of America, Wells Fargo, etc.)
  - Custom column mapping
  - Date format detection
  - Amount parsing (positive/negative, debits/credits)

- **Import Process**
  1. Upload CSV file
  2. Preview first 10 rows
  3. Map columns:
     - Date column
     - Description column
     - Amount column
     - Balance column (optional)
  4. Select bank account
  5. Set import date range (filter rows)
  6. Review duplicates (match existing transactions)
  7. Import (creates transactions)

- **Transaction Matching**
  - Match by date + amount
  - Match by description
  - Flag duplicates
  - Auto-reconcile if exact match

**CSV Import UI:**
```
CSV Import
├── Step 1: Upload File
│   └── Drag & drop or browse
├── Step 2: Preview & Map
│   ├── Table preview (first 10 rows)
│   ├── Column mapping dropdowns
│   └── Date format selector
├── Step 3: Select Account
│   └── Bank account dropdown
├── Step 4: Review
│   ├── Total transactions count
│   ├── Duplicates detected (if any)
│   └── Date range summary
└── Step 5: Import
    ├── Progress bar
    └── Results summary
```

#### 2.3 Transaction Management
- **Transaction List**
  - Filter by: Date range, Account, Type, Status
  - Search by description, reference number
  - Sort by date, amount
  - Bulk actions: Reconcile, Export

- **Transaction Detail**
  - View full transaction details
  - View ledger entries
  - View source (Stripe, CSV import, Manual)
  - Reconciliation status
  - Related documents

#### 2.4 Expense Entry
- **Quick Expense Entry**
  - Date, Amount, Description
  - Vendor, Category
  - Receipt upload
  - Payment method
  - Post to ledger

#### 2.5 Reconciliation
- **Bank Reconciliation**
  - Select bank account
  - Enter statement date
  - Enter ending balance
  - Match transactions
  - Mark as reconciled

#### 2.6 Reports
- **Financial Reports**
  - Income Statement
  - Balance Sheet
  - Trial Balance
  - Cash Flow Statement

### UI Components

```
Financials
├── Dashboard
│   ├── Bank Accounts Summary
│   ├── Recent Transactions
│   └── Quick Actions
├── Bank Accounts
│   ├── Account List
│   ├── Add Account
│   └── Starting Balance Setup
├── Transactions
│   ├── Transaction List
│   ├── CSV Import
│   └── Transaction Detail
├── Expenses
│   ├── Expense List
│   └── New Expense
├── Reconciliation
│   └── Bank Reconciliation
└── Reports
    ├── Income Statement
    ├── Balance Sheet
    ├── Trial Balance
    └── Cash Flow
```

### Access Control
- **Standard Users**: Can view and enter transactions
- **Accounting Admin**: Full access including reconciliation
- **Read-Only**: View-only access for reports

---

## Navigation Structure

### Platform Navigation

```
Platform
├── Settings
│   └── Tune Financial Engine (Admin only)
│       ├── Chart of Accounts
│       ├── Forecast Logic
│       └── Setup Engine
└── Financials
    ├── Dashboard
    ├── Bank Accounts
    ├── Transactions
    ├── Expenses
    ├── Reconciliation
    └── Reports
```

### User Roles

**Platform Admin**
- Full access to Tune Financial Engine
- Full access to Financials
- Can configure system

**Accounting Admin**
- Read-only access to Tune Financial Engine (view config)
- Full access to Financials
- Can post transactions, reconcile

**Standard User**
- No access to Tune Financial Engine
- Can view Financials (read-only or limited write)
- Can enter expenses (draft)

---

## Database Schema Updates

### Bank Accounts Model

```prisma
model bank_accounts {
  id                String   @id @default(cuid())
  companyHQId      String
  accountName      String   // e.g., "Business Checking"
  accountType      BankAccountType // CHECKING, SAVINGS, CREDIT_CARD
  accountNumber    String?  // Last 4 digits (masked)
  bankName         String?
  startingBalance  Int      // Starting balance in cents
  startingDate     DateTime // When to begin tracking
  currentBalance   Int      // Calculated current balance
  isActive         Boolean  @default(true)
  
  // Stripe integration
  stripeAccountId  String?  // Link to Stripe account
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  company_hqs      company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  transactions     transactions[]
  
  @@index([companyHQId])
  @@index([isActive])
  @@map("bank_accounts")
}

enum BankAccountType {
  CHECKING
  SAVINGS
  CREDIT_CARD
  MONEY_MARKET
  OTHER
}
```

### CSV Import Model

```prisma
model csv_imports {
  id                String   @id @default(cuid())
  companyHQId      String
  bankAccountId    String
  fileName          String
  fileUrl           String   // S3/storage URL
  rowCount          Int
  importedCount     Int      @default(0)
  duplicateCount    Int      @default(0)
  errorCount        Int      @default(0)
  status            ImportStatus @default(PENDING)
  columnMapping     Json     // Column mapping configuration
  dateRangeStart    DateTime?
  dateRangeEnd      DateTime?
  errorLog          Json?    // Error details
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  importedBy        String?  // User ID
  
  company_hqs       company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  bank_accounts     bank_accounts @relation(fields: [bankAccountId], references: [id])
  
  @@index([companyHQId])
  @@index([bankAccountId])
  @@index([status])
  @@map("csv_imports")
}

enum ImportStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  PARTIAL
}
```

### Update Transactions Model

```prisma
model transactions {
  // ... existing fields ...
  bankAccountId     String?  // FK to bank_accounts
  bank_accounts    bank_accounts? @relation(fields: [bankAccountId], references: [id])
  csvImportId       String?  // FK to csv_imports (if imported from CSV)
  csv_imports       csv_imports? @relation(fields: [csvImportId], references: [id])
}
```

---

## Implementation Phases

### Phase 1: Tune Financial Engine (Week 1-2)
- [ ] Chart of Accounts management UI
- [ ] Forecast logic configuration UI
- [ ] Setup wizard
- [ ] System settings

### Phase 2: Financials - Bank Setup (Week 2-3)
- [ ] Bank account management
- [ ] Starting balance entry
- [ ] Opening balance transaction creation

### Phase 3: Financials - CSV Import (Week 3-4)
- [ ] CSV upload interface
- [ ] Column mapping UI
- [ ] CSV parsing logic
- [ ] Transaction creation from CSV
- [ ] Duplicate detection
- [ ] Error handling

### Phase 4: Financials - Operations (Week 4-5)
- [ ] Transaction list/view
- [ ] Expense entry
- [ ] Reconciliation
- [ ] Reports

### Phase 5: Integration (Week 5-6)
- [ ] Stripe webhook integration
- [ ] Link Stripe transactions to bank accounts
- [ ] End-to-end flow testing

---

## CSV Import Specifications

### Supported CSV Formats

#### Standard Format (Chase, Bank of America, etc.)
```csv
Date,Description,Amount,Balance
2025-01-15,PAYMENT RECEIVED,1000.00,5000.00
2025-01-16,OFFICE SUPPLIES,-50.00,4950.00
```

#### Alternative Format (Wells Fargo, etc.)
```csv
Transaction Date,Description,Debit,Credit,Balance
01/15/2025,PAYMENT RECEIVED,,1000.00,5000.00
01/16/2025,OFFICE SUPPLIES,50.00,,4950.00
```

### Column Mapping Options

**Date Columns:**
- Date, Transaction Date, Post Date, etc.
- Auto-detect date format (MM/DD/YYYY, YYYY-MM-DD, etc.)

**Amount Columns:**
- Single amount column (positive = credit, negative = debit)
- Separate Debit/Credit columns
- Amount + Type column (D/C indicator)

**Description Columns:**
- Description, Memo, Notes, Payee, etc.

**Balance Columns (Optional):**
- Balance, Running Balance, etc.
- Used for validation

### Import Validation

1. **Date Validation**: Ensure dates are valid and within range
2. **Amount Validation**: Ensure amounts are numeric
3. **Duplicate Detection**: Match by date + amount + description
4. **Balance Validation**: If balance column exists, validate running balance
5. **Account Validation**: Ensure bank account exists and is active

### Error Handling

- **Row-level errors**: Log errors but continue processing
- **Validation errors**: Show in preview before import
- **Duplicate handling**: 
  - Skip duplicates (default)
  - Import as new (option)
  - Manual review (option)

---

## User Flows

### Initial Setup Flow

1. **Admin goes to Tune Financial Engine**
   - Sets up chart of accounts (load template or create)
   - Configures forecast logic
   - Completes setup wizard

2. **Admin goes to Financials**
   - Adds bank accounts
   - Sets starting balances
   - System ready for use

3. **Users can now:**
   - Import CSV bank statements
   - Enter expenses
   - View reports

### CSV Import Flow

1. **User navigates to Financials → Transactions → Import CSV**
2. **Upload CSV file**
3. **System previews and detects columns**
4. **User maps columns** (if needed)
5. **User selects bank account**
6. **User sets date range** (optional filter)
7. **System shows preview** with duplicates highlighted
8. **User confirms import**
9. **System processes** and creates transactions
10. **User sees results** (imported count, duplicates, errors)

### Bank Reconciliation Flow

1. **User downloads bank statement** (CSV or PDF)
2. **User imports CSV** (if CSV) or manually enters transactions
3. **User navigates to Reconciliation**
4. **User selects bank account and statement date**
5. **User enters ending balance from statement**
6. **System shows unmatched transactions**
7. **User matches transactions** (check off matches)
8. **User adds missing transactions** (bank fees, etc.)
9. **System calculates difference** (should be $0)
10. **User marks as reconciled**

---

## Technical Considerations

### CSV Parsing Library
- Use `papaparse` or similar for CSV parsing
- Handle various encodings (UTF-8, Windows-1252, etc.)
- Handle quoted fields, escaped quotes
- Handle different line endings (CRLF, LF)

### File Upload
- Use existing upload system (UploadThing or similar)
- Store CSV files temporarily
- Clean up after import

### Performance
- Process CSV in batches (100 rows at a time)
- Show progress indicator
- Allow cancellation
- Handle large files (10k+ rows)

### Security
- Validate file types (CSV only)
- Scan for malicious content
- Limit file size (e.g., 10MB max)
- Company-scoped access

---

## Future Enhancements

1. **OFX/QFX Import**: Support Quicken/QuickBooks formats
2. **Bank API Integration**: Direct bank connection (Plaid)
3. **Auto-Reconciliation**: AI-powered transaction matching
4. **Receipt OCR**: Extract data from receipt images
5. **Recurring Transactions**: Auto-create recurring transactions

---

## Questions to Resolve

1. **CSV File Storage**: Store permanently or delete after import?
2. **Duplicate Handling**: Default behavior for duplicates?
3. **Starting Balance**: Required or optional?
4. **Multiple Bank Accounts**: Can users have multiple accounts?
5. **Forecast Logic**: Required or optional feature?
6. **Access Control**: Who can import CSV? Who can reconcile?
