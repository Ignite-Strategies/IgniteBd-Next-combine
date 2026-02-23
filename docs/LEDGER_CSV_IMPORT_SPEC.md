# CSV Bank Statement Import Specification

## Overview

The CSV import feature allows users to import bank statement transactions from CSV files. This enables automatic transaction creation and bank reconciliation.

## Location

**Route**: `/financials/transactions/import`

## Supported CSV Formats

### Format 1: Standard Format (Chase, Bank of America)
```csv
Date,Description,Amount,Balance
2025-01-15,PAYMENT RECEIVED,1000.00,5000.00
2025-01-16,OFFICE SUPPLIES,-50.00,4950.00
2025-01-17,STRIPE DEPOSIT,250.00,5200.00
```

### Format 2: Separate Debit/Credit Columns (Wells Fargo)
```csv
Transaction Date,Description,Debit,Credit,Balance
01/15/2025,PAYMENT RECEIVED,,1000.00,5000.00
01/16/2025,OFFICE SUPPLIES,50.00,,4950.00
01/17/2025,STRIPE DEPOSIT,,250.00,5200.00
```

### Format 3: Single Amount with Type Indicator
```csv
Date,Description,Type,Amount,Balance
2025-01-15,PAYMENT RECEIVED,CREDIT,1000.00,5000.00
2025-01-16,OFFICE SUPPLIES,DEBIT,50.00,4950.00
```

## Column Mapping

### Required Columns
- **Date**: Transaction date (any date format)
- **Amount**: Transaction amount (or separate Debit/Credit columns)

### Optional Columns
- **Description**: Transaction description/memo
- **Balance**: Running balance (for validation)
- **Reference Number**: Check number, transaction ID, etc.
- **Category**: Transaction category (if provided by bank)

## Date Format Detection

The system will auto-detect common date formats:
- `YYYY-MM-DD` (2025-01-15)
- `MM/DD/YYYY` (01/15/2025)
- `DD/MM/YYYY` (15/01/2025)
- `MM-DD-YYYY` (01-15-2025)
- `DD-MM-YYYY` (15-01-2025)

## Amount Parsing

### Single Amount Column
- Positive values = Credits (deposits, income)
- Negative values = Debits (withdrawals, expenses)
- Or use separate Debit/Credit columns

### Separate Debit/Credit Columns
- Debit column: Withdrawals (positive values)
- Credit column: Deposits (positive values)
- System combines into single amount (Credit - Debit)

## Import Process

### Step 1: Upload CSV File
- Drag & drop or browse
- File size limit: 10MB
- File type validation: CSV only
- Preview first 10 rows

### Step 2: Column Mapping
- System auto-detects columns
- User can manually map columns:
  - Date column dropdown
  - Description column dropdown
  - Amount column dropdown (or Debit/Credit)
  - Balance column dropdown (optional)
- Date format selector

### Step 3: Select Bank Account
- Dropdown of active bank accounts
- Required selection

### Step 4: Set Date Range (Optional)
- Filter transactions by date range
- Only import transactions within range
- Useful for partial imports

### Step 5: Preview & Review
- Show all transactions to be imported
- Highlight duplicates (if detected)
- Show summary:
  - Total transactions
  - Date range
  - Amount range
  - Duplicates count

### Step 6: Import
- Process transactions in batches (100 at a time)
- Show progress indicator
- Create transactions and ledger entries
- Handle errors gracefully

## Duplicate Detection

### Matching Criteria
Transactions are considered duplicates if they match on:
1. **Date + Amount** (exact match)
2. **Date + Description** (fuzzy match on description)
3. **Date + Amount + Description** (exact match on all three)

### Duplicate Handling Options
- **Skip**: Don't import duplicates (default)
- **Import as New**: Import all transactions (creates duplicates)
- **Manual Review**: Flag for user review

## Transaction Creation

### From CSV Row
Each CSV row creates:
1. **Transaction** record:
   - `transactionType`: Determined by amount (positive = REVENUE, negative = EXPENSE)
   - `transactionDate`: From CSV date column
   - `description`: From CSV description column
   - `totalAmount`: Absolute value of amount
   - `bankAccountId`: Selected bank account
   - `csvImportId`: Link to import record
   - `sourceType`: "BANK_SYNC"

2. **Ledger Entries** (double-entry):
   - **Debit Entry**: Bank Account (if debit/withdrawal)
   - **Credit Entry**: Bank Account (if credit/deposit)
   - Or: Debit Bank Account, Credit Revenue/Expense account (if categorized)

### Account Mapping
- **Deposits** (positive amounts):
  - Debit: Bank Account
  - Credit: Revenue Account (default) or mapped account
  
- **Withdrawals** (negative amounts):
  - Debit: Expense Account (default) or mapped account
  - Credit: Bank Account

## Error Handling

### Row-Level Errors
- Invalid date format → Skip row, log error
- Invalid amount → Skip row, log error
- Missing required column → Skip row, log error
- Date out of range → Skip row (if date range filter set)

### Import-Level Errors
- File too large → Reject upload
- Invalid file format → Reject upload
- No bank account selected → Show error
- No valid transactions → Show warning

### Error Log
Stored in `csv_imports.errorLog` JSON field:
```json
{
  "errors": [
    {
      "row": 5,
      "error": "Invalid date format",
      "data": "2025-13-45"
    },
    {
      "row": 12,
      "error": "Invalid amount",
      "data": "abc"
    }
  ]
}
```

## API Endpoints

### Upload CSV File
```http
POST /api/financials/csv/upload
Content-Type: multipart/form-data

file: <CSV file>
companyHQId: <company ID>
```

**Response:**
```json
{
  "success": true,
  "uploadId": "upload_123",
  "rowCount": 150,
  "preview": [
    {
      "date": "2025-01-15",
      "description": "PAYMENT RECEIVED",
      "amount": 1000.00
    }
  ]
}
```

### Preview CSV
```http
POST /api/financials/csv/preview
Content-Type: application/json

{
  "uploadId": "upload_123",
  "columnMapping": {
    "date": "Date",
    "description": "Description",
    "amount": "Amount"
  },
  "dateFormat": "YYYY-MM-DD"
}
```

**Response:**
```json
{
  "success": true,
  "preview": [
    {
      "row": 1,
      "date": "2025-01-15",
      "description": "PAYMENT RECEIVED",
      "amount": 1000.00,
      "parsed": true
    }
  ],
  "duplicates": [5, 12],
  "errors": []
}
```

### Import CSV
```http
POST /api/financials/csv/import
Content-Type: application/json

{
  "uploadId": "upload_123",
  "bankAccountId": "bank_abc",
  "columnMapping": {
    "date": "Date",
    "description": "Description",
    "amount": "Amount"
  },
  "dateFormat": "YYYY-MM-DD",
  "dateRangeStart": "2025-01-01",
  "dateRangeEnd": "2025-01-31",
  "duplicateHandling": "skip"
}
```

**Response:**
```json
{
  "success": true,
  "importId": "import_456",
  "importedCount": 145,
  "duplicateCount": 3,
  "errorCount": 2,
  "status": "COMPLETED"
}
```

### Get Import History
```http
GET /api/financials/csv/imports?companyHQId=<id>
```

**Response:**
```json
{
  "success": true,
  "imports": [
    {
      "id": "import_456",
      "fileName": "bank_statement.csv",
      "bankAccountId": "bank_abc",
      "rowCount": 150,
      "importedCount": 145,
      "duplicateCount": 3,
      "errorCount": 2,
      "status": "COMPLETED",
      "createdAt": "2025-01-20T10:00:00Z"
    }
  ]
}
```

## UI Components

### CSV Upload Component
```jsx
<CSVUpload
  onUpload={(file) => handleUpload(file)}
  maxSize={10 * 1024 * 1024} // 10MB
  acceptedTypes={['.csv', 'text/csv']}
/>
```

### Column Mapping Component
```jsx
<ColumnMapping
  columns={detectedColumns}
  mappings={columnMappings}
  onChange={(mappings) => setColumnMappings(mappings)}
  dateFormats={['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY']}
/>
```

### Preview Component
```jsx
<CSVPreview
  rows={previewRows}
  duplicates={duplicateRows}
  errors={errorRows}
  onConfirm={() => handleImport()}
/>
```

### Import Progress Component
```jsx
<ImportProgress
  total={totalRows}
  processed={processedRows}
  imported={importedRows}
  errors={errorRows}
  status={importStatus}
/>
```

## Implementation Notes

### CSV Parsing Library
Use existing `parseCSV` utility from `@/lib/utils/csv` (same as contacts import).

### File Storage
- Store CSV files temporarily (S3 or similar)
- Clean up after 30 days
- Or delete immediately after import (user preference)

### Performance
- Process in batches (100 rows at a time)
- Use database transactions for each batch
- Show progress indicator
- Allow cancellation

### Security
- Validate file type (CSV only)
- Scan for malicious content
- Limit file size (10MB)
- Company-scoped access
- Rate limiting (max 10 imports per hour)

## Testing

### Test Cases
1. **Standard Format Import**
   - Upload CSV with Date, Description, Amount columns
   - Verify transactions created correctly

2. **Debit/Credit Format Import**
   - Upload CSV with separate Debit/Credit columns
   - Verify amounts calculated correctly

3. **Duplicate Detection**
   - Upload CSV with duplicate transactions
   - Verify duplicates detected and handled

4. **Date Range Filter**
   - Upload CSV with date range filter
   - Verify only transactions in range imported

5. **Error Handling**
   - Upload CSV with invalid data
   - Verify errors logged and skipped

6. **Large File Import**
   - Upload CSV with 10,000+ rows
   - Verify batch processing works
   - Verify progress indicator updates

## Future Enhancements

1. **OFX/QFX Support**: Import Quicken/QuickBooks formats
2. **PDF Import**: Extract transactions from PDF statements
3. **Bank API Integration**: Direct connection via Plaid
4. **Auto-Categorization**: AI-powered transaction categorization
5. **Recurring Transaction Detection**: Identify recurring transactions
6. **Multi-Account Import**: Import multiple accounts from single CSV
