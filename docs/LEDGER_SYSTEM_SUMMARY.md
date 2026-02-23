# Ledger System - Executive Summary

## Overview

This document provides a high-level summary of the ledger system implementation plan for IgniteBD platform. 

**START SIMPLE**: Phase 1 focuses on CSV import and inline categorization. No over-engineering. See `LEDGER_SIMPLE_START.md` for the simplified approach.

The full system will eventually provide comprehensive accounting capabilities including expense tracking, Stripe transaction integration, and a full general ledger with chart of accounts.

## UX Architecture

The system is split into **two separate UX areas**:

### 1. Tune Financial Engine (`/settings/financial-engine`)
**Purpose**: Configuration and setup (Admin only)
- Chart of Accounts management
- Forecast logic configuration
- Setup wizard
- System settings

### 2. Financials (`/financials`)
**Purpose**: Operational source of truth (All users)
- Bank account setup
- Starting balance entry
- CSV bank statement import
- Transaction management
- Expense entry
- Reconciliation
- Financial reports

See `LEDGER_UX_ARCHITECTURE.md` for detailed UX flows.

## Key Features

### 1. Chart of Accounts
- **Hybrid Schema**: Supports Income (4000s), Expenses (5000s), COGS (6000s), Assets (1000s), Liabilities (2000s), Equity (3000s)
- **Hierarchical Structure**: Parent/child account relationships
- **Customizable**: Each company can customize their chart of accounts
- **Default Templates**: Pre-configured account structures for quick setup

### 2. Expense Tracking
- **Manual Entry**: Create expenses with receipt upload
- **Categorization**: Map expenses to chart of accounts
- **Draft/Posted Workflow**: Save drafts, post when ready
- **Payment Methods**: Track credit card, check, cash, bank transfer

### 3. Stripe Integration
- **Automatic Recording**: Stripe webhooks create ledger entries automatically
- **End-to-End Tracking**: From Stripe payment → Bank deposit
- **Transaction Linking**: Links to invoices and payment records
- **Refund Handling**: Automatically handles refunds and chargebacks

### 4. General Ledger
- **Double-Entry Bookkeeping**: Enforced at database level
- **Transaction Posting**: All entries must balance (debits = credits)
- **Account Balances**: Real-time balance calculations
- **Audit Trail**: Complete history of all transactions

### 5. Financial Reports
- **Income Statement (P&L)**: Revenue, COGS, Expenses, Net Income
- **Balance Sheet**: Assets, Liabilities, Equity
- **Trial Balance**: All accounts with balances
- **Cash Flow Statement**: Operating, Investing, Financing activities

### 6. Bank Account Setup
- **Bank Account Management**: Add/edit bank accounts
- **Starting Balance**: Set initial balance and date
- **Opening Balance Entry**: Creates opening balance transaction

### 7. CSV Bank Statement Import
- **CSV Upload**: Drag & drop CSV file upload
- **Column Mapping**: Map CSV columns to transaction fields
- **Preview**: Preview transactions before import
- **Duplicate Detection**: Automatically detect duplicate transactions
- **Transaction Creation**: Creates ledger entries from CSV rows

### 8. Bank Reconciliation
- **Transaction Matching**: Match ledger entries with bank transactions
- **Reconciliation Reports**: Generate reconciliation statements

## Database Schema

### New Models
1. **chart_of_accounts** - Account definitions
2. **transactions** - Transaction headers (groups entries)
3. **ledger_entries** - Individual debit/credit entries
4. **expenses** - Expense records (before posting)
5. **bank_accounts** - Bank account definitions
6. **csv_imports** - CSV import tracking and history

### Updated Models
- **invoices** - Add `transactionId` link
- **payments** - Add `transactionId` link
- **company_hqs** - Add relations to new models
- **transactions** - Add `bankAccountId` and `csvImportId` links

## Implementation Timeline

### Phase 1: Tune Financial Engine (Week 1-2)
- Database schema and migrations
- Chart of accounts management UI (`/settings/financial-engine`)
- Forecast logic configuration
- Setup wizard

### Phase 2: Financials - Bank Setup & CSV Import (Week 2-3)
- Bank account management UI (`/financials/bank-accounts`)
- Starting balance entry
- CSV bank statement import (`/financials/transactions/import`)
- Column mapping and preview
- Duplicate detection

### Phase 3: Financials - Expense Tracking (Week 3-4)
- Expense entry form (`/financials/expenses/new`)
- Expense list and detail views
- Posting expenses to ledger

### Phase 4: Stripe Integration (Week 4-5)
- Enhance webhook handler
- Automatic ledger entry creation
- Stripe transaction tracking
- Link to bank accounts

### Phase 5: General Ledger & Reports (Week 5-6)
- Ledger entry system
- Double-entry validation
- Account balance calculations
- Financial reports (P&L, Balance Sheet, Trial Balance, Cash Flow)

### Phase 6: Bank Reconciliation (Week 6-7)
- Reconciliation UI (`/financials/reconciliation`)
- Transaction matching
- Reconciliation reports

### Phase 7: UX Polish & Testing (Week 7-8)
- Dashboard improvements
- Export functionality
- Testing and bug fixes

## Key Design Decisions

### 1. Hybrid Chart of Accounts
- **Why**: Balances simplicity with accounting standards
- **Structure**: 
  - Income (4000s) - All revenue sources
  - Expenses (5000s) - Operating expenses
  - COGS (6000s) - Direct costs (separate from expenses for better P&L)
  - Assets (1000s) - Cash, receivables, equipment
  - Liabilities (2000s) - Payables, loans
  - Equity (3000s) - Owner's equity, retained earnings

### 2. Double-Entry Bookkeeping
- **Why**: Industry standard, ensures accuracy
- **Implementation**: Every transaction has equal debits and credits
- **Validation**: Enforced at database level

### 3. Transaction Grouping
- **Why**: Multiple ledger entries per transaction (double-entry)
- **Structure**: `transactions` table groups `ledger_entries`
- **Example**: Revenue transaction has 2 entries (Debit Cash, Credit Revenue)

### 4. Source Tracking
- **Why**: Trace transactions back to origin
- **Types**: Manual, Stripe, Bank Sync, Adjustment, Reconciliation
- **Benefit**: Audit trail and reconciliation

### 5. Draft/Posted Workflow
- **Why**: Allow editing before committing to ledger
- **Flow**: Expense → Draft → Posted → Reconciled
- **Benefit**: Prevents errors, maintains audit trail

## Integration Points

### Existing Systems
- **Stripe Webhooks**: Enhanced to create ledger entries
- **Invoices**: Linked to transactions
- **Payments**: Linked to transactions
- **Company HQ**: Scoped to company level

### Future Integrations
- **Bank Sync**: Plaid integration for automatic import
- **Accounting Software**: QuickBooks, Xero export
- **Tax Software**: Export for tax preparation

## Success Metrics

- ✅ All Stripe transactions automatically recorded
- ✅ Manual expenses can be entered and categorized
- ✅ Financial reports are accurate
- ✅ Bank reconciliation can be performed monthly
- ✅ Chart of accounts is customizable per company

## Documentation Files

1. **LEDGER_SYSTEM_IMPLEMENTATION_PLAN.md** - Complete implementation plan
2. **LEDGER_SCHEMA_ADDITIONS.md** - Exact Prisma schema additions
3. **LEDGER_UX_ARCHITECTURE.md** - Two separate UX areas (Tune Financial Engine + Financials)
4. **LEDGER_UX_FLOWS.md** - User experience flows and wireframes
5. **LEDGER_SYSTEM_SUMMARY.md** - This summary document

## Next Steps

1. **Review & Approve**: Review all documentation
2. **Create Migrations**: Generate Prisma migrations
3. **Build Foundation**: Chart of accounts management
4. **Iterate**: Build features incrementally
5. **Test**: Comprehensive testing at each phase

## Questions to Resolve

Before starting implementation, resolve:

1. **Multi-currency**: Support multiple currencies or USD only?
2. **Fiscal Year**: Custom fiscal years or calendar year?
3. **Approval Workflow**: Do expenses need approval before posting?
4. **Tax Tracking**: Track tax categories (deductible expenses)?
5. **Reporting Frequency**: Monthly, quarterly, or custom?
6. **User Permissions**: Who can create accounts, post transactions, reconcile?

## Technical Stack

- **Database**: PostgreSQL (via Prisma)
- **Backend**: Next.js API routes
- **Frontend**: React/Next.js
- **Payment Processing**: Stripe
- **File Storage**: Receipt uploads (existing upload system)

## Security Considerations

- **Company Scoping**: Users can only see their company's data
- **Role-Based Access**: Different permissions for different roles
- **Audit Logging**: Track all financial changes
- **Data Validation**: Validate all inputs
- **Transaction Integrity**: Database-level constraints

## Performance Considerations

- **Indexing**: Index all foreign keys and frequently queried fields
- **Caching**: Cache account balances (invalidate on new entries)
- **Pagination**: Paginate large transaction lists
- **Archiving**: Archive old transactions for performance

## Migration Strategy

1. **Non-Breaking**: Add new tables without affecting existing functionality
2. **Backfill**: Migrate historical data from invoices/payments
3. **Feature Flags**: Enable features gradually
4. **User Migration**: Migrate users over time

## Support & Maintenance

- **Error Handling**: Comprehensive error handling
- **Logging**: Detailed logging for debugging
- **Monitoring**: Monitor transaction volumes and performance
- **Backup**: Regular database backups (existing process)

---

**Status**: Planning Complete ✅  
**Next**: Review and begin Phase 1 implementation
