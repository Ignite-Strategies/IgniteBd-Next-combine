# Microsoft Contact Management - Current State & Improvement Plan

## Overview

This document summarizes the current state of Microsoft contact management (load/manage flow) and identifies areas for improvement based on the "boss fight" around performance and UX.

## Current Architecture

### Flow: Preview → Review → Save → Success

```
1. Preview Page (/contacts/ingest/microsoft)
   ↓ User selects source (email/contacts)
   ↓ Calls /api/microsoft/email-contacts/preview or /api/microsoft/contacts/preview
   ↓ Returns up to 50 contacts per batch (pagination via skip parameter)
   ↓ User selects contacts to import

2. Review Page (/contacts/ingest/microsoft/review)
   ↓ Reads preview items from sessionStorage
   ↓ Calls /api/microsoft/contacts/review
   ↓ Maps preview → Contact structure
   ↓ Checks which emails already exist (across user's companyHQs)
   ↓ Shows "Already in Contacts" vs "Will Import" badges

3. Save API (/api/microsoft/email-contacts/save or /api/microsoft/contacts/save)
   ↓ Filters selected items
   ↓ Maps preview → Contact structure
   ↓ Checks existence per companyHQ (findFirst with email + crmId)
   ↓ Creates contacts
   ↓ Returns saved contact IDs

4. Success Page (/contacts/ingest/microsoft/success)
   ↓ Receives contact IDs from URL params
   ↓ Loads all contacts in parallel (Promise.all)
   ↓ Shows one contact at a time with inline editing
   ↓ Allows: notes, company assignment, enrichment, pipeline assignment
```

## Current State - What's Working ✅

1. **Connection Status**: Fixed to use API endpoint, not localStorage
2. **Save Route**: Fixed to check per companyHQ (matches schema constraint)
3. **Non-Blocking UI**: Source selection always shows (not blocked by connection check)
4. **Pagination**: Preview endpoints support skip parameter
5. **Success Page**: Enhanced with inline editing capabilities
6. **Error Handling**: Handles 401 (not connected), race conditions (P2002)

## Potential Performance Issues ⚠️

### 1. Preview Page - Microsoft Graph API Calls

**Current Behavior**:
- Fetches 100 messages (email) or 200 contacts per request
- Processes and filters to return 50 unique contacts
- Early exit optimization when 50 contacts found

**Potential Issues**:
- Microsoft Graph API latency (network call)
- Processing 100-200 items server-side
- No caching - always fresh (good for accuracy, slower for UX)

**Location**: `app/api/microsoft/email-contacts/preview/route.js`, `app/api/microsoft/contacts/preview/route.js`

### 2. Review Page - Database Lookup

**Current Behavior**:
- Calls `/api/microsoft/contacts/review`
- Checks existing contacts across ALL user's companyHQs
- Uses `findMany` with `crmId: { in: companyHQIds }` and `email: { in: emails }`

**Potential Issues**:
- If user has many companyHQs → large IN clause
- If many contacts selected → large email array
- Sequential database query (not batched)

**Location**: `app/api/microsoft/contacts/review/route.js`, `lib/contactFromPreviewService.js`

### 3. Success Page - Parallel Contact Loading

**Current Behavior**:
- Loads all saved contacts in parallel using `Promise.all`
- Each contact fetched via `/api/contacts/[contactId]`

**Potential Issues**:
- If many contacts saved → many parallel API calls
- Each API call fetches full contact with relations
- No batching - could overwhelm server

**Location**: `app/(authenticated)/contacts/ingest/microsoft/success/page.jsx` (lines 46-70)

### 4. Save Route - Sequential Contact Creation

**Current Behavior**:
- Loops through contacts sequentially
- Each contact: check existence → create (if not exists)

**Potential Issues**:
- Sequential processing (not batched)
- N+1 database queries (one per contact)
- Could be slow for large batches

**Location**: `app/api/microsoft/email-contacts/save/route.js` (lines 109-156)

## Identified Improvement Areas

### Priority 1: Performance Optimizations

#### A. Batch Contact Creation
**Current**: Sequential `create()` calls
**Proposed**: Use `createMany()` or batch transactions
**Impact**: Faster saves for large batches

#### B. Batch Contact Loading (Success Page)
**Current**: Parallel individual API calls
**Proposed**: Single API endpoint that accepts array of IDs
**Impact**: Fewer HTTP requests, faster loading

#### C. Optimize Review API Query
**Current**: `findMany` with large IN clauses
**Proposed**: 
- Batch queries if too many emails
- Add database indexes if missing
- Consider caching "already exists" checks

**Impact**: Faster review page load

#### D. Add Loading States & Progress Indicators
**Current**: Basic loading spinners
**Proposed**: 
- Progress bars for batch operations
- Estimated time remaining
- Better feedback during long operations

**Impact**: Better UX during slow operations

### Priority 2: UX Improvements

#### A. Streamline Success Page
**Current**: One contact at a time, manual navigation
**Proposed**: 
- List view with inline editing
- Bulk actions (assign company to multiple)
- Skip/next improvements

**Impact**: Faster workflow for multiple contacts

#### B. Improve Error Messages
**Current**: Generic error messages
**Proposed**: 
- Specific error messages (which contact failed, why)
- Retry mechanisms
- Better handling of partial failures

**Impact**: Better user experience when things go wrong

#### C. Add Preview Improvements
**Current**: Shows 50 contacts per batch
**Proposed**: 
- Better pagination UI
- "Load more" instead of "Next batch"
- Show total available contacts

**Impact**: Better understanding of available contacts

### Priority 3: Code Quality

#### A. Reduce Code Duplication
**Current**: Similar logic in email-contacts and contacts endpoints
**Proposed**: Shared service functions
**Impact**: Easier maintenance, fewer bugs

#### B. Add TypeScript Types
**Current**: JavaScript files
**Proposed**: Add TypeScript types for API responses
**Impact**: Better type safety, fewer runtime errors

## Recommended Starting Points

### Quick Wins (1-2 hours each)

1. **Batch Contact Loading API**
   - Create `/api/contacts/batch` endpoint
   - Accept array of contact IDs
   - Return array of contacts
   - Update success page to use it

2. **Add Progress Indicators**
   - Add progress bar to save operation
   - Show "Saving contact X of Y"
   - Better loading states

3. **Optimize Review Query**
   - Check if indexes exist on `email` and `crmId`
   - Add batching if query is too large
   - Consider caching strategy

### Medium Effort (3-5 hours each)

1. **Batch Contact Creation**
   - Refactor save route to use `createMany` or transactions
   - Handle partial failures gracefully
   - Return detailed results

2. **Success Page List View**
   - Add list view option
   - Inline editing in list
   - Bulk actions

3. **Better Error Handling**
   - Specific error messages
   - Retry mechanisms
   - Partial failure handling

### Larger Refactors (1-2 days)

1. **Unified Preview Service**
   - Consolidate email-contacts and contacts preview logic
   - Shared filtering/processing
   - Consistent response format

2. **Caching Strategy**
   - Cache Microsoft Graph API responses (with TTL)
   - Cache "already exists" checks
   - Invalidate on save

## Next Steps

1. **Measure Current Performance**
   - Add timing logs to API endpoints
   - Measure preview load time
   - Measure review load time
   - Measure save time
   - Measure success page load time

2. **Identify Bottlenecks**
   - Which step is slowest?
   - Database queries slow?
   - Microsoft Graph API slow?
   - Frontend rendering slow?

3. **Start with Highest Impact**
   - Fix the slowest part first
   - Measure improvement
   - Iterate

## Code Locations

### Frontend Pages
- Preview: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`
- Review: `app/(authenticated)/contacts/ingest/microsoft/review/page.jsx`
- Success: `app/(authenticated)/contacts/ingest/microsoft/success/page.jsx`

### API Routes
- Email Preview: `app/api/microsoft/email-contacts/preview/route.js`
- Contacts Preview: `app/api/microsoft/contacts/preview/route.js`
- Review: `app/api/microsoft/contacts/review/route.js`
- Email Save: `app/api/microsoft/email-contacts/save/route.js`
- Contacts Save: `app/api/microsoft/contacts/save/route.js`

### Services
- Contact Mapping: `lib/contactFromPreviewService.js`
- Microsoft Graph: `lib/microsoftGraphClient.js`

## Questions to Answer

1. **What's the actual bottleneck?**
   - Is it Microsoft Graph API latency?
   - Database query performance?
   - Frontend rendering?
   - Network requests?

2. **What's the user's pain point?**
   - Slow initial load?
   - Slow save operation?
   - Slow success page?
   - Confusing UX?

3. **What's the scale?**
   - How many contacts per import?
   - How many companyHQs per user?
   - How often is this used?

---

**Status**: Ready for performance analysis and targeted improvements
**Last Updated**: 2025-01-28
