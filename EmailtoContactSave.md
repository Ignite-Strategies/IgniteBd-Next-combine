# Email to Contact Save - Complete Flow Analysis

## Overview

This document provides a comprehensive analysis of how contacts are saved from Microsoft email/contacts preview, including how we check for existing contacts and the complete data flow.

## Architecture: Modular 3-Step Flow

### Flow: Preview → Review → Save

```
1. Preview Page
   ↓ User selects contacts
2. Review Page  
   ↓ Maps preview → Contact model, checks existing
3. Save API
   ↓ Creates contacts in database
```

## Step 1: Preview Page (`/contacts/ingest/microsoft`)

### What Happens

**File**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`

1. **Load Preview**
   - Calls `/api/microsoft/email-contacts/preview` or `/api/microsoft/contacts/preview`
   - Gets list of contacts from Microsoft Graph API
   - Displays in table with checkboxes

2. **User Selects Contacts**
   - Frontend stores `previewId` in `selectedIds` Set
   - `previewId` = SHA256 hash of email address (first 16 chars)

3. **Click "Review Selected"**
   - Stores preview items in `sessionStorage`:
     - `microsoftPreviewItems` = full preview items array
     - `microsoftSelectedIds` = array of selected previewIds
   - Navigates to `/contacts/ingest/microsoft/review?companyHQId=X&source=email`

### Preview Data Structure

**From Email Contacts** (`/api/microsoft/email-contacts/preview`):
```javascript
{
  previewId: "abc123...", // hash of email
  email: "joel@example.com",
  displayName: "Joel Smith",
  domain: "example.com",
  stats: {
    firstSeenAt: "2025-01-20T...",
    lastSeenAt: "2025-01-27T...",
    messageCount: 5
  }
}
```

**From Contacts** (`/api/microsoft/contacts/preview`):
```javascript
{
  previewId: "abc123...", // hash of email
  email: "joel@example.com",
  displayName: "Joel Smith",
  domain: "example.com",
  companyName: "Acme Corp",
  jobTitle: "CEO"
}
```

**Key Point**: Preview does NOT check if contacts already exist - that happens in Review step.

## Step 2: Review Page (`/contacts/ingest/microsoft/review`)

### What Happens

**File**: `app/(authenticated)/contacts/ingest/microsoft/review/page.jsx`

1. **Load Review Data**
   - Reads `microsoftPreviewItems` and `microsoftSelectedIds` from `sessionStorage`
   - Filters to only selected items
   - Calls `/api/microsoft/contacts/review` API

2. **Review API** (`/api/microsoft/contacts/review`)
   - Uses `contactFromPreviewService.prepareContactsForReview()`
   - Maps each preview item to Contact structure
   - Checks which emails already exist in database
   - Returns mapped contacts with `alreadyExists` flag

3. **Display Review Table**
   - Shows: Name, Email, First Name, Last Name, Status
   - Status badges:
     - "Already in Contacts" (yellow) - if `alreadyExists: true`
     - "Will Import" (green) - if `alreadyExists: false`
   - Shows summary: "X new, Y already exist"

4. **User Reviews & Clicks "Save"**
   - Calls save API with mapped contacts
   - Navigates back to preview page with success message

### Review API Flow

**Endpoint**: `POST /api/microsoft/contacts/review`

**Service**: `lib/contactFromPreviewService.js`

```javascript
// 1. Map preview items to Contact structure
const contactData = mapPreviewItemToContact(previewItem);
// Returns: { email, firstName, lastName }

// 2. Check which emails already exist
const existingEmails = await checkExistingContacts(emails, companyHQIds);
// Returns: Set of email addresses that exist

// 3. Mark each contact
const alreadyExists = existingEmails.has(contactData.email);
```

### How "Already Exists" is Checked

**Function**: `checkExistingContacts(emails, companyHQIds)`

**Query**:
```javascript
prisma.contact.findMany({
  where: {
    crmId: { in: companyHQIds },  // Check across ALL companyHQs user has access to
    email: { in: emailLower },     // Check if email matches
  },
  select: {
    email: true,  // Only need email, not full contact
  },
})
```

**Key Points**:
- ✅ Checks across **ALL companyHQs** the owner has access to (not just current one)
- ✅ Uses `email` field as unique identifier
- ✅ Email is normalized (lowercase, trimmed)
- ✅ Returns Set for O(1) lookup

**Why Check All CompanyHQs?**
- User might have imported contact in different company
- Prevents duplicate imports across companies
- Better UX - shows if contact exists anywhere

### Mapping Logic

**Function**: `mapPreviewItemToContact(previewItem)`

**Process**:
1. Normalize email: `email.toLowerCase().trim()`
2. Parse `displayName` into `firstName`/`lastName`:
   - 1 word → `firstName = word`
   - 2+ words → `firstName = first word`, `lastName = rest`
3. Returns: `{ email, firstName, lastName }`

**Example**:
```javascript
// Input:
{ displayName: "Joel Smith", email: "joel@example.com" }

// Output:
{ email: "joel@example.com", firstName: "Joel", lastName: "Smith" }
```

## Step 3: Save API

### Two Save Endpoints

1. **Email Contacts**: `POST /api/microsoft/email-contacts/save`
2. **Microsoft Contacts**: `POST /api/microsoft/contacts/save`

Both use the same logic, just different endpoints.

### Save Flow

**File**: `app/api/microsoft/email-contacts/save/route.js`

1. **Authentication & Validation**
   - Verify Firebase token
   - Get owner from Firebase ID
   - Validate `previewIds`, `previewItems`, `companyHQId`
   - Check membership in CompanyHQ

2. **Filter Selected Items**
   ```javascript
   const itemsToSave = previewItems.filter(item => 
     previewIds.includes(item.previewId)
   );
   ```

3. **Map to Contact Structure**
   ```javascript
   const contactsToSave = itemsToSave.map(item => 
     mapPreviewItemToContact(item)
   );
   ```

4. **Save Each Contact**
   ```javascript
   for (const contactData of contactsToSave) {
     // Check if already exists (by email)
     const existing = await prisma.contact.findUnique({
       where: { email },
     });

     if (existing) {
       skipped++;
       continue;  // Skip if exists
     }

     // Create contact
     await prisma.contact.create({
       data: {
         crmId: companyHQId,
         email: contactData.email,
         firstName: contactData.firstName,
         lastName: contactData.lastName,
       },
     });

     saved++;
   }
   ```

5. **Return Results**
   ```javascript
   {
     success: true,
     saved: 3,
     skipped: 2,
     message: "Saved 3 contacts"
   }
   ```

### How "Already Saved" is Checked (During Save)

**Query**:
```javascript
const existing = await prisma.contact.findUnique({
  where: { email },
});
```

**Key Points**:
- ❌ **ONLY checks by email** (not firstName/lastName)
- ❌ **Does NOT check companyHQ** - checks globally across ALL contacts
- ✅ Uses Prisma `findUnique` with email (assumes email is unique)
- ✅ If exists → skip (don't create duplicate)
- ✅ Handles race conditions (P2002 error = unique constraint violation)

**Problem**: This checks GLOBALLY, not per companyHQ!

### Contact Model Schema

**File**: `prisma/schema.prisma`

```prisma
model Contact {
  id        String   @id @default(cuid())
  crmId     String   // CompanyHQ ID
  email     String   @unique  // UNIQUE constraint on email (global!)
  firstName String?
  lastName  String?
  // ... other fields
}
```

**Key Constraint**: `email` is `@unique` - means ONE contact per email across ENTIRE database, not per companyHQ.

## Critical Issues Identified

### Issue 1: Duplicate Check Logic Inconsistency ⚠️

**Review Step** (`checkExistingContacts`):
- Checks: `crmId: { in: companyHQIds }` - checks across user's companyHQs
- Purpose: Show which contacts already exist in user's companies

**Save Step** (`findUnique`):
- Checks: `where: { email }` - checks GLOBALLY (all contacts, all companies)
- Purpose: Prevent duplicate creation

**Problem**: 
- Review might say "doesn't exist" (not in user's companies)
- Save might skip it (exists in different company)
- User sees "0 saved" but contact exists elsewhere

**Example**:
```
1. User imports "joel@example.com" in Company A
2. User tries to import same email in Company B
3. Review: "Doesn't exist" (not in Company B)
4. Save: Skips (email exists globally)
5. Result: "0 saved" - confusing!
```

### Issue 2: Email Uniqueness Constraint ⚠️

**Schema**: `email String @unique`

**Implication**:
- One email = one contact globally
- Cannot have same email in different companyHQs
- If contact exists in Company A, cannot import to Company B

**Question**: Is this intentional?
- If YES → Need to check globally in review step too
- If NO → Need to remove `@unique` constraint and check per `crmId`

### Issue 3: Race Condition Handling ✅

**Current**: Handles P2002 error (unique constraint violation)
```javascript
catch (error) {
  if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
    skipped++;  // Race condition - another request created it
  }
}
```

**Good**: Prevents crashes if two users import same contact simultaneously.

## Data Flow Diagram

```
User selects contacts on Preview Page
  ↓
Store in sessionStorage:
  - microsoftPreviewItems: [{ previewId, email, displayName, ... }]
  - microsoftSelectedIds: ["hash1", "hash2", ...]
  ↓
Navigate to Review Page
  ↓
Review Page loads:
  - Read sessionStorage
  - Filter to selected items
  - POST /api/microsoft/contacts/review
    ↓
    contactFromPreviewService.prepareContactsForReview()
      ↓
      1. mapPreviewItemToContact() for each item
         → { email, firstName, lastName }
      ↓
      2. checkExistingContacts(emails, companyHQIds)
         → prisma.contact.findMany({
             where: { crmId: { in: companyHQIds }, email: { in: emails } }
           })
         → Returns Set of existing emails
      ↓
      3. Mark each contact: alreadyExists = existingEmails.has(email)
      ↓
    Returns: [{ previewId, email, firstName, lastName, alreadyExists, ... }]
  ↓
Display Review Table:
  - Show mapping (firstName, lastName)
  - Show status (Already in Contacts / Will Import)
  - Show summary stats
  ↓
User clicks "Save"
  ↓
POST /api/microsoft/email-contacts/save
  Body: {
    previewIds: [...],
    previewItems: [...],
    companyHQId: "..."
  }
  ↓
  1. Filter items by previewIds
  ↓
  2. Map using mapPreviewItemToContact()
  ↓
  3. For each contact:
     a. Check: prisma.contact.findUnique({ where: { email } })
     b. If exists → skip
     c. If not exists → create:
        prisma.contact.create({
          data: {
            crmId: companyHQId,
            email,
            firstName,
            lastName
          }
        })
  ↓
Return: { saved: X, skipped: Y }
  ↓
Navigate back to Preview Page with success message
```

## How "Already Saved" is Checked - Two Places

### 1. Review Step (Preview Before Save)

**Location**: `lib/contactFromPreviewService.js` → `checkExistingContacts()`

**Query**:
```javascript
prisma.contact.findMany({
  where: {
    crmId: { in: companyHQIds },  // User's companyHQs
    email: { in: emailLower },     // Selected emails
  },
})
```

**Scope**: Checks across user's companyHQs
**Purpose**: Show user which contacts already exist in their companies
**Result**: Sets `alreadyExists` flag on each contact

### 2. Save Step (During Save)

**Location**: `app/api/microsoft/email-contacts/save/route.js`

**Query**:
```javascript
prisma.contact.findUnique({
  where: { email },  // GLOBAL check - no crmId filter!
})
```

**Scope**: Checks GLOBALLY (all contacts, all companies)
**Purpose**: Prevent duplicate creation (enforced by `@unique` constraint)
**Result**: Skips contact if exists

## The Problem: Inconsistent Checks

### Scenario: Contact Exists in Different Company

```
1. Contact "joel@example.com" exists in Company A (crmId: "company-a")
2. User (who has access to Company B) tries to import same email
3. Review Step:
   - Checks: crmId IN ["company-b"] → NOT FOUND
   - Shows: "Will Import" ✅
4. Save Step:
   - Checks: email = "joel@example.com" → FOUND (exists globally)
   - Skips: skipped++
5. Result: "0 saved" - user confused!
```

### Why This Happens

**Review checks**: User's companyHQs only
**Save checks**: Globally (all companies)

**Schema constraint**: `email @unique` prevents same email in different companies

## Solutions

### Option 1: Make Review Check Global (Match Save Logic)

**Change**: Review step checks globally, not just user's companyHQs

**Pros**:
- Consistent with save step
- User sees accurate "already exists" status
- No surprises

**Cons**:
- User might not know contact exists in different company
- Less useful information

### Option 2: Remove Email Uniqueness, Check Per CompanyHQ

**Change**: 
- Remove `@unique` from email
- Add unique constraint: `@@unique([crmId, email])`
- Check per companyHQ in both review and save

**Pros**:
- Allows same email in different companies
- More flexible
- Review and save logic match

**Cons**:
- Schema change (migration needed)
- Might allow duplicates if that's not desired

### Option 3: Check Globally in Review, Show Which Company

**Change**:
- Review checks globally
- If exists, show which companyHQ it's in
- User can decide if they want to import anyway

**Pros**:
- Accurate information
- User can make informed decision
- No schema changes

**Cons**:
- More complex UI
- Still can't import if email is unique

## Current Behavior Summary

### Review Step
- ✅ Maps preview → Contact structure
- ✅ Checks existing in user's companyHQs
- ✅ Shows "Already in Contacts" badge
- ⚠️ Might miss contacts in other companies

### Save Step
- ✅ Maps preview → Contact structure (again)
- ✅ Checks existing globally
- ✅ Skips if exists
- ✅ Creates if doesn't exist
- ⚠️ Might skip even if review said "new"

### Result
- User might see "Will Import" in review
- But save returns "0 saved" because contact exists globally
- Confusing UX!

## Recommendations

1. **Make Review Check Global** (Quick Fix)
   - Change `checkExistingContacts` to check globally
   - Match save logic
   - User sees accurate status

2. **Consider Schema Change** (Long-term)
   - If contacts should be per-companyHQ, remove `@unique` from email
   - Add `@@unique([crmId, email])` instead
   - Update both review and save to check per companyHQ

3. **Better Error Messages**
   - If save skips contact that review said was new, explain why
   - Show which company the contact exists in

## Code Locations

### Service
- `lib/contactFromPreviewService.js` - Mapping and existing check logic

### API Routes
- `app/api/microsoft/contacts/review/route.js` - Review preparation
- `app/api/microsoft/email-contacts/save/route.js` - Email contacts save
- `app/api/microsoft/contacts/save/route.js` - Contacts save

### Frontend
- `app/(authenticated)/contacts/ingest/microsoft/page.jsx` - Preview page
- `app/(authenticated)/contacts/ingest/microsoft/review/page.jsx` - Review page

### Schema
- `prisma/schema.prisma` - Contact model definition

---

**Status**: Analysis complete - ready for decision on fix approach
