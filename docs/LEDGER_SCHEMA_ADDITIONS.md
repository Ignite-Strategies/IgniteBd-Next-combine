# Ledger System - Prisma Schema Additions

This document contains the exact Prisma schema additions needed for the ledger system.

## New Models

```prisma
// Chart of Accounts
model chart_of_accounts {
  id              String   @id @default(cuid())
  companyHQId    String
  accountNumber  String   // e.g., "4000", "5000", "6000"
  accountName    String   // e.g., "Revenue", "Office Supplies", "Cost of Goods Sold"
  accountType    AccountType // INCOME, EXPENSE, COGS, ASSET, LIABILITY, EQUITY
  parentAccountId String? // For hierarchical accounts (optional)
  isActive       Boolean  @default(true)
  description    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  company_hqs    company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  parentAccount  chart_of_accounts? @relation("AccountHierarchy", fields: [parentAccountId], references: [id])
  childAccounts  chart_of_accounts[] @relation("AccountHierarchy")
  ledger_entries ledger_entries[]
  expenses       expenses[]
  
  @@unique([companyHQId, accountNumber])
  @@index([companyHQId])
  @@index([accountType])
  @@index([parentAccountId])
  @@map("chart_of_accounts")
}

// General Ledger Entries
model ledger_entries {
  id                String   @id @default(cuid())
  companyHQId      String
  transactionId    String   // FK to transactions (many entries per transaction)
  accountId        String   // FK to chart_of_accounts
  entryType        EntryType // DEBIT or CREDIT
  amount           Int      // Amount in cents
  currency         String   @default("USD")
  description      String?
  referenceNumber  String?  // Check number, invoice number, etc.
  transactionDate  DateTime
  postedAt         DateTime @default(now())
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // Reconciliation fields
  isReconciled     Boolean  @default(false)
  reconciledAt     DateTime?
  reconciledBy     String?  // User ID who reconciled
  
  // Source tracking
  sourceType       SourceType // MANUAL, STRIPE, BANK_SYNC, ADJUSTMENT
  sourceId         String?  // ID of source (invoice.id, stripe_payment_intent, etc.)
  
  company_hqs      company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  account          chart_of_accounts @relation(fields: [accountId], references: [id])
  transaction      transactions @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  
  @@index([companyHQId])
  @@index([transactionId])
  @@index([accountId])
  @@index([transactionDate])
  @@index([isReconciled])
  @@index([sourceType, sourceId])
  @@map("ledger_entries")
}

// Transactions (groups ledger entries)
model transactions {
  id                String   @id @default(cuid())
  companyHQId      String
  transactionType  TransactionType
  transactionDate  DateTime
  description       String
  totalAmount       Int      // Total in cents (sum of all entries)
  currency          String   @default("USD")
  status            TransactionStatus @default(PENDING)
  
  // External references
  invoiceId         String?  // FK to invoices
  stripePaymentIntentId String? @unique
  stripeInvoiceId   String?
  stripeChargeId    String?
  
  // Bank reconciliation
  bankTransactionId String? // From bank sync (future)
  isReconciled     Boolean  @default(false)
  reconciledAt     DateTime?
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  company_hqs      company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  invoices         invoices? @relation(fields: [invoiceId], references: [id])
  ledger_entries   ledger_entries[]
  expenses         expenses[]
  
  @@index([companyHQId])
  @@index([transactionType])
  @@index([transactionDate])
  @@index([status])
  @@index([invoiceId])
  @@index([stripePaymentIntentId])
  @@index([isReconciled])
  @@map("transactions")
}

// Expense Entries
model expenses {
  id                String   @id @default(cuid())
  companyHQId      String
  expenseDate       DateTime
  amount           Int      // Amount in cents
  currency         String   @default("USD")
  description       String
  vendor            String?  // Vendor name
  category          String?  // Quick category (maps to chart of accounts)
  accountId         String   // FK to chart_of_accounts
  receiptUrl        String?  // Receipt attachment
  paymentMethod     String?  // "credit_card", "check", "cash", "bank_transfer"
  referenceNumber   String?  // Check number, transaction ID, etc.
  
  // Ledger integration
  transactionId     String?  // FK to transactions (created when posted)
  
  // Status
  status            ExpenseStatus @default(DRAFT)
  postedAt          DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  createdBy         String?  // User ID
  
  company_hqs       company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  account           chart_of_accounts @relation(fields: [accountId], references: [id])
  transaction       transactions? @relation(fields: [transactionId], references: [id])
  
  @@index([companyHQId])
  @@index([expenseDate])
  @@index([accountId])
  @@index([status])
  @@index([transactionId])
  @@map("expenses")
}
```

## New Enums

```prisma
enum AccountType {
  INCOME      // Revenue accounts (4000-4999)
  EXPENSE     // Operating expenses (5000-5999)
  COGS        // Cost of Goods Sold (6000-6999)
  ASSET       // Assets (1000-1999)
  LIABILITY   // Liabilities (2000-2999)
  EQUITY      // Equity (3000-3999)
}

enum EntryType {
  DEBIT
  CREDIT
}

enum SourceType {
  MANUAL        // Manual entry
  STRIPE        // From Stripe webhook
  BANK_SYNC     // From bank account sync (future)
  ADJUSTMENT    // Manual adjustment/correction
  RECONCILIATION // Reconciliation entry
}

enum TransactionType {
  REVENUE          // Income transaction
  EXPENSE          // Expense transaction
  TRANSFER         // Transfer between accounts
  ADJUSTMENT       // Manual adjustment
  RECONCILIATION   // Bank reconciliation
}

enum TransactionStatus {
  PENDING
  POSTED
  RECONCILED
  VOIDED
}

enum ExpenseStatus {
  DRAFT
  POSTED
  VOIDED
}
```

## New Models (Bank & CSV Import)

```prisma
// Bank Accounts
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
  csv_imports     csv_imports[]
  
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

// CSV Imports
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
  transactions     transactions[]
  
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

## Updates to Existing Models

### Update `company_hqs` model:
```prisma
model company_hqs {
  // ... existing fields ...
  
  chart_of_accounts chart_of_accounts[]
  ledger_entries    ledger_entries[]
  transactions      transactions[]
  expenses          expenses[]
  bank_accounts     bank_accounts[]
  csv_imports       csv_imports[]
}
```

### Update `transactions` model:
```prisma
model transactions {
  // ... existing fields ...
  
  bankAccountId     String?  // FK to bank_accounts
  bank_accounts    bank_accounts? @relation(fields: [bankAccountId], references: [id])
  csvImportId       String?  // FK to csv_imports (if imported from CSV)
  csv_imports       csv_imports? @relation(fields: [csvImportId], references: [id])
}
```

### Update `invoices` model:
```prisma
model invoices {
  // ... existing fields ...
  transactionId String? @unique // Link to ledger transaction
  transactions  transactions? @relation(fields: [transactionId], references: [id])
}
```

### Update `payments` model:
```prisma
model payments {
  // ... existing fields ...
  transactionId String? // Link to ledger transaction
  transactions   transactions? @relation(fields: [transactionId], references: [id])
}
```

## Migration Strategy

1. Add new models first (non-breaking)
2. Add foreign keys to existing models
3. Backfill data from existing invoices/payments
4. Enable new features gradually

## Default Chart of Accounts Seed Data

See `LEDGER_SYSTEM_IMPLEMENTATION_PLAN.md` for the default account structure.
