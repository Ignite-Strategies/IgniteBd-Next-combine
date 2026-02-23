# Ledger System - UX Flows

This document outlines the user experience flows for the ledger system.

## 1. Chart of Accounts Management

### View Chart of Accounts
**Route:** `/settings/accounting/chart-of-accounts`

**UI Components:**
- Table view with columns: Account Number, Account Name, Type, Balance, Status
- Filter by account type (Income, Expense, COGS, etc.)
- Search by account number or name
- Expandable hierarchy view for parent/child accounts

**Actions:**
- Add new account
- Edit account
- Deactivate account (soft delete)
- View account details
- View transaction history for account

### Create/Edit Account
**Modal/Form Fields:**
- Account Number (required, unique per company)
- Account Name (required)
- Account Type (dropdown: Income, Expense, COGS, Asset, Liability, Equity)
- Parent Account (optional, dropdown of existing accounts)
- Description (optional)
- Active/Inactive toggle

**Validation:**
- Account number must be unique within company
- Account number should follow convention (1000s for Assets, 4000s for Income, etc.)
- Cannot deactivate account with balance or recent transactions

## 2. Expense Entry Flow

### Quick Expense Entry
**Route:** `/expenses/new` or Quick Add button in header

**Form Fields:**
- Date (default: today)
- Amount (required)
- Description (required)
- Vendor (optional)
- Category (dropdown mapped to chart of accounts)
- Payment Method (Credit Card, Check, Cash, Bank Transfer)
- Reference Number (optional)
- Receipt Upload (optional, drag & drop)

**Posting:**
- Save as Draft (can edit later)
- Post to Ledger (creates transaction, cannot edit)
- Cancel

### Expense List View
**Route:** `/expenses`

**Features:**
- Filter by: Date range, Category, Status (Draft/Posted), Vendor
- Sort by: Date, Amount, Vendor
- Bulk actions: Post multiple drafts, Export
- Quick actions: Edit (if draft), View, Delete (if draft)

**Columns:**
- Date
- Description
- Vendor
- Category
- Amount
- Status
- Actions

### Expense Detail View
**Route:** `/expenses/[id]`

**Shows:**
- All expense details
- Receipt image (if uploaded)
- Linked transaction (if posted)
- Ledger entries created
- Edit/Delete buttons (if draft)

## 3. Financial Dashboard

### Dashboard Overview
**Route:** `/dashboard/accounting` or `/accounting`

**Widgets:**
- Current Month Revenue (Income accounts)
- Current Month Expenses (Expense + COGS accounts)
- Net Income (Revenue - Expenses - COGS)
- Cash Balance (Asset accounts)
- Recent Transactions (last 10)
- Unreconciled Transactions count
- Quick Actions: Add Expense, View Reports

**Charts:**
- Income vs Expenses (monthly trend)
- Expense breakdown by category (pie chart)
- Cash flow (line chart)

## 4. General Ledger View

### Transaction List
**Route:** `/ledger/transactions`

**Filters:**
- Date range
- Account
- Transaction type
- Status (Pending, Posted, Reconciled)
- Source (Manual, Stripe, Bank Sync)

**Columns:**
- Date
- Description
- Type
- Amount
- Status
- Accounts (shows debit/credit accounts)
- Actions (View, Reconcile, Void)

### Transaction Detail
**Route:** `/ledger/transactions/[id]`

**Shows:**
- Transaction header (date, description, type, amount)
- Ledger entries table:
  - Account
  - Entry Type (Debit/Credit)
  - Amount
  - Description
- Source information (Stripe payment ID, Invoice ID, etc.)
- Reconciliation status
- Related documents (invoice, receipt, etc.)

## 5. Reports

### Income Statement (P&L)
**Route:** `/reports/income-statement`

**Parameters:**
- Start Date
- End Date
- Compare to previous period (toggle)

**Report Structure:**
```
Revenue
  Service Revenue          $X,XXX
  Product Revenue          $X,XXX
  Subscription Revenue     $X,XXX
  Total Revenue            $X,XXX

Cost of Goods Sold
  Direct Labor             $X,XXX
  Contractor Fees          $X,XXX
  Total COGS               $X,XXX

Gross Profit               $X,XXX

Expenses
  Office Supplies          $X,XXX
  Rent                     $X,XXX
  Marketing                $X,XXX
  Total Expenses           $X,XXX

Net Income                 $X,XXX
```

**Actions:**
- Export PDF
- Export CSV
- Print
- Email report

### Balance Sheet
**Route:** `/reports/balance-sheet`

**Parameters:**
- As of Date

**Report Structure:**
```
ASSETS
  Current Assets
    Cash                   $X,XXX
    Bank Account           $X,XXX
    Accounts Receivable    $X,XXX
    Total Current Assets   $X,XXX
  
  Fixed Assets
    Equipment              $X,XXX
    Less: Depreciation     ($X,XXX)
    Net Fixed Assets       $X,XXX

  Total Assets             $X,XXX

LIABILITIES
  Current Liabilities
    Accounts Payable       $X,XXX
    Credit Cards           $X,XXX
    Total Liabilities      $X,XXX

EQUITY
  Owner's Equity           $X,XXX
  Retained Earnings        $X,XXX
  Total Equity             $X,XXX

Total Liabilities + Equity $X,XXX
```

### Trial Balance
**Route:** `/reports/trial-balance`

**Parameters:**
- As of Date

**Report Structure:**
```
Account Number | Account Name | Debit | Credit
1000          | Cash         | $X,XXX| 
1100          | Bank Account | $X,XXX|
4000          | Revenue      |       | $X,XXX
5000          | Expenses    | $X,XXX|
              | TOTAL        | $X,XXX| $X,XXX
```

### Cash Flow Statement
**Route:** `/reports/cash-flow`

**Parameters:**
- Start Date
- End Date

**Report Structure:**
```
Cash from Operations
  Net Income               $X,XXX
  Adjustments              $X,XXX
  Net Cash from Operations $X,XXX

Cash from Investing
  Equipment Purchases      ($X,XXX)
  Net Cash from Investing  ($X,XXX)

Cash from Financing
  Owner Contributions      $X,XXX
  Net Cash from Financing $X,XXX

Net Change in Cash         $X,XXX
Beginning Cash            $X,XXX
Ending Cash               $X,XXX
```

## 6. Bank Reconciliation

### Reconciliation View
**Route:** `/ledger/reconciliation`

**Process:**
1. Select bank account
2. Enter statement ending date
3. Enter ending balance from statement
4. System shows:
   - All unreconciled transactions
   - Calculated book balance
   - Difference (should be $0 when reconciled)
5. Match transactions:
   - Check off transactions that appear on statement
   - Add missing transactions (bank fees, etc.)
   - Mark as reconciled
6. Generate reconciliation report

**Reconciliation Report:**
```
Beginning Balance          $X,XXX
Add: Deposits              $X,XXX
Less: Withdrawals          ($X,XXX)
Ending Book Balance        $X,XXX
Ending Statement Balance   $X,XXX
Difference                 $0.00
```

## 7. Stripe Integration (Automatic)

### Automatic Transaction Creation
When Stripe webhook fires (`invoice.paid`):
1. System automatically creates transaction
2. Creates ledger entries:
   - Debit: Cash/Bank account
   - Credit: Revenue account
3. Links to invoice record
4. User sees transaction in ledger automatically
5. Can be reconciled when bank deposit clears

### Stripe Transaction View
**Route:** `/ledger/stripe-transactions`

**Shows:**
- All Stripe-originated transactions
- Stripe payment intent ID
- Invoice ID
- Status (Pending, Posted, Reconciled)
- Link to Stripe dashboard

## 8. Navigation Structure

### Main Navigation
```
Accounting
├── Dashboard
├── Expenses
│   ├── All Expenses
│   └── New Expense
├── Chart of Accounts
├── Transactions
│   ├── All Transactions
│   └── Reconciliation
└── Reports
    ├── Income Statement
    ├── Balance Sheet
    ├── Trial Balance
    └── Cash Flow
```

## 9. Mobile Considerations

### Mobile-Optimized Views
- Simplified expense entry form
- Quick expense capture with camera (receipt)
- Dashboard with key metrics
- Transaction list with swipe actions

## 10. Permissions & Roles

### Accounting Admin
- Full access to all accounting features
- Can create/edit chart of accounts
- Can post transactions
- Can reconcile accounts
- Can view all reports

### Standard User
- Can create expenses (draft)
- Can view own expenses
- Can view reports (read-only)
- Cannot post transactions
- Cannot modify chart of accounts

### View Only
- Can view reports
- Cannot create or edit anything

## Design Principles

1. **Simplicity First**: Hide complexity, show what's needed
2. **Progressive Disclosure**: Advanced features available but not overwhelming
3. **Visual Feedback**: Clear status indicators (Draft, Posted, Reconciled)
4. **Error Prevention**: Validation before posting, confirmations for important actions
5. **Audit Trail**: Show who did what and when
6. **Mobile Friendly**: Core features work on mobile devices

## Future Enhancements

1. **Receipt OCR**: Auto-fill expense form from receipt image
2. **Recurring Expenses**: Set up recurring expense templates
3. **Budgeting**: Set budgets by category, track vs actual
4. **Multi-currency**: Support for multiple currencies
5. **Tax Categories**: Tag expenses as tax-deductible
6. **Vendor Management**: Track vendors, payment terms
7. **Approval Workflow**: Multi-step approval for expenses
8. **Bank Sync**: Automatic import from bank accounts (Plaid)
