# Ledger System Implementation Plan

## Overview

This document outlines the implementation plan for adding a comprehensive fintech/ledger system to IgniteBD platform. The system will track general expenses, Stripe transactions, and provide end-to-end accounting capabilities with a general ledger and chart of accounts.

## Goals

1. **Track General Expenses** - Manual expense entry and categorization
2. **Track Stripe Transactions** - Automatic ledger entries from Stripe webhooks
3. **General Ledger** - Complete double-entry bookkeeping system
4. **Chart of Accounts** - Flexible, hybrid schema supporting Income, Expenses, COGS, Assets, Liabilities, Equity
5. **End-to-End Tracking** - From Stripe payment to bank account deposit
6. **UX for Chart Design** - User-friendly interface for managing chart of accounts

## Current State Analysis

### Existing Financial Models

- **invoices** - Tracks invoices (PLATFORM_FEE, MONTHLY_RECURRING, CUSTOM, WORK_PACKAGE, PLAN_SUBSCRIPTION)
- **payments** - Tracks payments against invoices
- **bills** - One-off billing items
- **plans** - Subscription plans
- **company_hqs** - Contains `stripeCustomerId`, `stripeSubscriptionId`, `planStatus`

### Stripe Integration

- Webhook handler at `/api/stripe/webhook/route.ts`
- Handles: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `subscription.updated`, `subscription.deleted`
- Creates invoices for PLAN_SUBSCRIPTION payments
- Updates company_hqs planStatus

### Gaps

- No general ledger system
- No chart of accounts
- No expense tracking
- No double-entry bookkeeping
- No bank reconciliation
- No financial reporting

## Architecture Design

### Database Schema

#### 1. Chart of Accounts (`chart_of_accounts`)

```prisma
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
  
  @@unique([companyHQId, accountNumber])
  @@index([companyHQId])
  @@index([accountType])
  @@index([parentAccountId])
  @@map("chart_of_accounts")
}

enum AccountType {
  INCOME      // Revenue accounts (4000-4999)
  EXPENSE     // Operating expenses (5000-5999)
  COGS        // Cost of Goods Sold (6000-6999)
  ASSET       // Assets (1000-1999)
  LIABILITY   // Liabilities (2000-2999)
  EQUITY      // Equity (3000-3999)
}
```

**Hybrid Schema Design:**
- **Income (4000-4999)**: Revenue from services, products, subscriptions
- **Expenses (5000-5999)**: Operating expenses (rent, utilities, marketing, etc.)
- **COGS (6000-6999)**: Direct costs (materials, contractor fees, etc.)
- **Assets (1000-1999)**: Cash, accounts receivable, equipment
- **Liabilities (2000-2999)**: Accounts payable, loans, credit cards
- **Equity (3000-3999)**: Owner's equity, retained earnings

#### 2. General Ledger (`ledger_entries`)

```prisma
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
```

#### 3. Transactions (`transactions`)

```prisma
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
  
  @@index([companyHQId])
  @@index([transactionType])
  @@index([transactionDate])
  @@index([status])
  @@index([invoiceId])
  @@index([stripePaymentIntentId])
  @@index([isReconciled])
  @@map("transactions")
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
```

#### 4. Expense Entries (`expenses`)

```prisma
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

enum ExpenseStatus {
  DRAFT
  POSTED
  VOIDED
}
```

### Schema Updates to Existing Models

#### Update `invoices` model:
```prisma
model invoices {
  // ... existing fields ...
  transactionId String? @unique // Link to ledger transaction
  transactions  transactions? @relation(fields: [transactionId], references: [id])
}
```

#### Update `payments` model:
```prisma
model payments {
  // ... existing fields ...
  transactionId String? // Link to ledger transaction
  transactions   transactions? @relation(fields: [transactionId], references: [id])
}
```

## UX Architecture

The ledger system is split into **two separate UX areas**:

### 1. Tune Financial Engine (`/settings/financial-engine`)
**Purpose**: Configuration and setup (Admin only)

**Features:**
- Chart of Accounts management
- Forecast logic configuration
- Setup engine wizard
- System settings

**Access**: Platform/Accounting Admins only

### 2. Financials (`/financials`)
**Purpose**: Operational source of truth (All users)

**Features:**
- Bank account setup
- Starting balance entry
- CSV bank statement import
- Transaction management
- Expense entry
- Reconciliation
- Financial reports

**Access**: Standard users (with role-based permissions)

See `LEDGER_UX_ARCHITECTURE.md` for detailed UX flows.

## Implementation Phases

### Phase 1: Tune Financial Engine (Week 1-2)

#### 1.1 Database Schema
- [ ] Create Prisma migrations for new models
- [ ] Add foreign key relationships
- [ ] Create indexes for performance
- [ ] Seed default chart of accounts templates

#### 1.2 Tune Financial Engine - Chart of Accounts
- [ ] API routes for CRUD operations on chart of accounts
- [ ] UI component in `/settings/financial-engine/chart-of-accounts`
- [ ] Account hierarchy visualization
- [ ] Account number validation
- [ ] Account templates (load/export)

**API Routes:**
- `GET /api/financial-engine/chart-of-accounts` - List all accounts
- `POST /api/financial-engine/chart-of-accounts` - Create account
- `PUT /api/financial-engine/chart-of-accounts/[id]` - Update account
- `DELETE /api/financial-engine/chart-of-accounts/[id]` - Deactivate account
- `GET /api/financial-engine/chart-of-accounts/templates` - Get default templates

**UI Components:**
- Chart of Accounts table view
- Account creation/edit form
- Account hierarchy tree view
- Account type selector with descriptions

#### 1.3 Tune Financial Engine - Forecast Logic
- [ ] Forecast rules configuration UI
- [ ] Forecast templates management
- [ ] Forecast settings form

**API Routes:**
- `GET /api/financial-engine/forecast-rules` - Get forecast rules
- `PUT /api/financial-engine/forecast-rules` - Update forecast rules
- `GET /api/financial-engine/forecast-templates` - List templates
- `POST /api/financial-engine/forecast-templates` - Create template

#### 1.4 Tune Financial Engine - Setup Wizard
- [ ] Multi-step setup wizard
- [ ] System settings form
- [ ] Initial configuration flow

### Phase 2: Financials - Bank Setup & CSV Import (Week 2-3)

#### 2.1 Financials - Bank Account Setup
- [ ] Bank account management UI (`/financials/bank-accounts`)
- [ ] Add/edit bank accounts
- [ ] Starting balance entry form
- [ ] Opening balance transaction creation

**API Routes:**
- `GET /api/financials/bank-accounts` - List bank accounts
- `POST /api/financials/bank-accounts` - Create bank account
- `PUT /api/financials/bank-accounts/[id]` - Update bank account
- `POST /api/financials/bank-accounts/[id]/starting-balance` - Set starting balance

**UI Components:**
- Bank account list
- Add bank account form
- Starting balance entry form
- Bank account detail view

#### 2.2 Financials - CSV Bank Statement Import
- [ ] CSV upload interface (`/financials/transactions/import`)
- [ ] CSV file parsing (using existing parseCSV utility)
- [ ] Column mapping UI
- [ ] Preview imported transactions
- [ ] Duplicate detection
- [ ] Transaction creation from CSV rows
- [ ] Error handling and reporting

**API Routes:**
- `POST /api/financials/csv/upload` - Upload CSV file
- `POST /api/financials/csv/preview` - Preview CSV (first 10 rows)
- `POST /api/financials/csv/import` - Import CSV transactions
- `GET /api/financials/csv/imports` - List import history
- `GET /api/financials/csv/imports/[id]` - Get import details

**UI Components:**
- CSV upload (drag & drop)
- Column mapping interface
- Preview table
- Import progress indicator
- Import results summary

**CSV Format Support:**
- Standard formats (Chase, Bank of America, Wells Fargo)
- Custom column mapping
- Date format detection
- Amount parsing (positive/negative, debits/credits)

### Phase 3: Financials - Expense Tracking (Week 3-4)

#### 3.1 Expense Entry
- [ ] Expense creation form (`/financials/expenses/new`)
- [ ] Receipt upload functionality
- [ ] Expense categorization
- [ ] Expense list/view page

**API Routes:**
- `GET /api/financials/expenses` - List expenses (with filters)
- `POST /api/financials/expenses` - Create expense
- `PUT /api/financials/expenses/[id]` - Update expense
- `DELETE /api/financials/expenses/[id]` - Delete expense
- `POST /api/financials/expenses/[id]/post` - Post expense to ledger

**UI Components:**
- Expense entry form
- Expense list with filters
- Receipt viewer
- Expense categories dropdown

#### 3.2 Expense Posting to Ledger
- [ ] Double-entry logic for expenses
- [ ] Automatic account selection based on category
- [ ] Transaction creation on posting

### Phase 4: Stripe Integration (Week 4-5)

#### 3.1 Stripe Webhook Enhancement
- [ ] Enhance webhook handler to create ledger entries
- [ ] Map Stripe events to ledger transactions
- [ ] Handle refunds and chargebacks

**Stripe Event Mapping:**
- `invoice.paid` → Revenue transaction (Debit: Cash/Bank, Credit: Revenue)
- `charge.refunded` → Refund transaction (Debit: Revenue, Credit: Cash/Bank)
- `payment_intent.succeeded` → Revenue transaction
- `transfer.created` → Bank deposit (when Stripe transfers to bank)

**Implementation:**
```typescript
// In webhook handler
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // ... existing invoice update logic ...
  
  // Create ledger transaction
  await createLedgerTransaction({
    companyHQId: company.id,
    transactionType: 'REVENUE',
    sourceType: 'STRIPE',
    sourceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    amount: invoice.amount_paid,
    description: `Payment for ${planName}`,
    entries: [
      {
        accountNumber: '1100', // Cash/Bank account
        entryType: 'DEBIT',
        amount: invoice.amount_paid,
      },
      {
        accountNumber: '4000', // Revenue account
        entryType: 'CREDIT',
        amount: invoice.amount_paid,
      },
    ],
  });
}
```

#### 3.2 Stripe Payout Tracking
- [ ] Track Stripe transfers to bank account
- [ ] Map Stripe balance transactions
- [ ] Reconciliation with bank statements

### Phase 5: General Ledger & Reports (Week 5-6)

#### 4.1 Ledger Entry System
- [ ] Double-entry validation
- [ ] Transaction posting logic
- [ ] Account balance calculations
- [ ] Ledger view/reporting

**API Routes:**
- `GET /api/financials/transactions` - List transactions
- `GET /api/financials/ledger-entries` - List ledger entries (with filters)
- `GET /api/financials/accounts/[id]/balance` - Get account balance
- `GET /api/financials/reports/trial-balance` - Trial balance report
- `GET /api/financials/reports/general-ledger` - General ledger report

**Double-Entry Validation:**
```typescript
function validateDoubleEntry(entries: LedgerEntry[]): boolean {
  const debits = entries
    .filter(e => e.entryType === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const credits = entries
    .filter(e => e.entryType === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);
  
  return debits === credits;
}
```

#### 4.2 Financial Reports
- [ ] Trial Balance
- [ ] Income Statement (P&L)
- [ ] Balance Sheet
- [ ] Cash Flow Statement

**Report API Routes:**
- `GET /api/financials/reports/trial-balance?date=YYYY-MM-DD`
- `GET /api/financials/reports/income-statement?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/financials/reports/balance-sheet?date=YYYY-MM-DD`
- `GET /api/financials/reports/cash-flow?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

### Phase 6: Bank Reconciliation (Week 6-7)

#### 6.1 Reconciliation UI
- [ ] Bank reconciliation interface (`/financials/reconciliation`)
- [ ] Statement date and balance entry
- [ ] Transaction matching interface
- [ ] Reconciliation report generation

**API Routes:**
- `GET /api/financials/reconciliation/[bankAccountId]` - Get reconciliation data
- `POST /api/financials/reconciliation/[bankAccountId]/reconcile` - Mark as reconciled
- `GET /api/financials/reconciliation/[bankAccountId]/report` - Generate report

**Note**: CSV import functionality is handled in Phase 2. Reconciliation uses imported transactions.

#### 6.2 Reconciliation Process
- [ ] Match ledger entries with bank transactions (from CSV import)
- [ ] Mark entries as reconciled
- [ ] Generate reconciliation reports
- [ ] Handle discrepancies

### Phase 7: UX Polish & Testing (Week 7-8)

#### 6.1 UI/UX Improvements
- [ ] Dashboard with financial overview
- [ ] Quick expense entry
- [ ] Transaction search and filters
- [ ] Export functionality (CSV, PDF)

#### 6.2 Testing
- [ ] Unit tests for ledger logic
- [ ] Integration tests for Stripe webhooks
- [ ] E2E tests for expense flow
- [ ] Performance testing for large datasets

## Default Chart of Accounts Template

### Income Accounts (4000-4999)
- 4000 - Service Revenue
- 4100 - Product Revenue
- 4200 - Subscription Revenue
- 4300 - Other Income

### Expense Accounts (5000-5999)
- 5000 - Office Supplies
- 5100 - Rent
- 5200 - Utilities
- 5300 - Marketing & Advertising
- 5400 - Professional Services
- 5500 - Software & Subscriptions
- 5600 - Travel & Entertainment
- 5700 - Insurance
- 5800 - Depreciation
- 5900 - Other Expenses

### COGS Accounts (6000-6999)
- 6000 - Direct Labor
- 6100 - Contractor Fees
- 6200 - Materials & Supplies
- 6300 - Cost of Services

### Asset Accounts (1000-1999)
- 1000 - Cash
- 1100 - Bank Account
- 1200 - Accounts Receivable
- 1300 - Prepaid Expenses
- 1400 - Equipment
- 1500 - Accumulated Depreciation

### Liability Accounts (2000-2999)
- 2000 - Accounts Payable
- 2100 - Credit Cards
- 2200 - Accrued Expenses
- 2300 - Loans Payable

### Equity Accounts (3000-3999)
- 3000 - Owner's Equity
- 3100 - Retained Earnings

## Technical Considerations

### Performance
- Index all foreign keys and frequently queried fields
- Use database views for complex reports
- Cache account balances (invalidate on new entries)
- Pagination for large transaction lists

### Data Integrity
- Enforce double-entry bookkeeping at database level (triggers)
- Prevent deletion of posted transactions (soft delete)
- Maintain audit trail of all changes
- Transaction rollback on errors

### Security
- Company-scoped access (users can only see their company's data)
- Role-based permissions (who can post transactions)
- Audit logging for financial changes
- Data validation on all inputs

### Scalability
- Consider partitioning ledger_entries by date for large datasets
- Archive old transactions
- Optimize queries with proper indexes
- Use database transactions for multi-entry operations

## Integration Points

### Stripe Webhooks
- Enhance existing webhook handler
- Create ledger entries automatically
- Link to existing invoice/payment records

### Future: Bank Account Sync
- Plaid integration for bank account connection
- Automatic transaction import
- Matching algorithm for reconciliation

### Future: Accounting Software Integration
- QuickBooks export
- Xero export
- CSV export for any accounting software

## Migration Strategy

1. **Create new tables** without breaking existing functionality
2. **Backfill historical data** from invoices/payments
3. **Enable new features** gradually (feature flags)
4. **Migrate users** to new system over time

## Success Metrics

- All Stripe transactions automatically recorded in ledger
- Manual expenses can be entered and categorized
- Financial reports are accurate and timely
- Bank reconciliation can be performed monthly
- Chart of accounts is customizable per company

## Next Steps

1. Review and approve this plan
2. Create database migrations
3. Build chart of accounts management UI
4. Implement expense tracking
5. Enhance Stripe webhook integration
6. Build financial reports
7. Add bank reconciliation

## Questions to Resolve

1. **Multi-currency support**: Should we support multiple currencies or just USD?
2. **Fiscal year**: Should companies be able to set custom fiscal years?
3. **Approval workflow**: Do expenses need approval before posting?
4. **Tax tracking**: Should we track tax categories (e.g., deductible expenses)?
5. **Reporting frequency**: Monthly, quarterly, or custom periods?
6. **User permissions**: Who can create accounts, post transactions, reconcile?

## References

- [Double-Entry Bookkeeping](https://en.wikipedia.org/wiki/Double-entry_bookkeeping)
- [Chart of Accounts Best Practices](https://www.accountingcoach.com/blog/chart-of-accounts)
- [Stripe Balance Transactions API](https://stripe.com/docs/api/balance_transactions)
- Existing Stripe webhook implementation: `/app/api/stripe/webhook/route.ts`
