# Microsoft Contact Management - Improvement Plan

## Current State Summary

Based on research, here's what we've built and where we can improve:

### ✅ What's Working
1. **Connection Status**: Fixed to use API (not localStorage)
2. **Save Logic**: Fixed to check per companyHQ (matches schema)
3. **Non-Blocking UI**: Source selection always shows
4. **Pagination**: Preview endpoints support skip parameter
5. **Success Page**: Enhanced with inline editing

### ⚠️ Performance Bottlenecks Identified

1. **Success Page**: Loads contacts one-by-one in parallel (many HTTP requests)
2. **Review API**: Single database query but could be optimized
3. **Save Route**: Sequential contact creation (N+1 queries)
4. **Preview**: Microsoft Graph API calls (network latency)

## Proposed Improvements (Prioritized)

### 🚀 Quick Wins (Start Here)

#### 1. Batch Contact Loading API
**Problem**: Success page makes N parallel API calls (one per contact)
**Solution**: Create `/api/contacts/batch` endpoint

**Implementation**:
```javascript
// New endpoint: app/api/contacts/batch/route.js
POST /api/contacts/batch
Body: { contactIds: ["id1", "id2", ...] }
Returns: { contacts: [...] }
```

**Impact**: Reduces N HTTP requests to 1

**Files to Create/Modify**:
- `app/api/contacts/batch/route.js` (new)
- `app/(authenticated)/contacts/ingest/microsoft/success/page.jsx` (modify)

---

#### 2. Batch Contact Creation
**Problem**: Save route creates contacts sequentially (N+1 queries)
**Solution**: Use `createMany` or batch transactions

**Current Code** (lines 109-156 in save route):
```javascript
for (const contactData of contactsToSave) {
  // Check existence
  const existing = await prisma.contact.findFirst(...);
  if (existing) { skipped++; continue; }
  // Create one by one
  await prisma.contact.create(...);
}
```

**Proposed**:
```javascript
// Batch check existence
const existingEmails = await prisma.contact.findMany({
  where: {
    email: { in: emails },
    crmId: companyHQId
  }
});
const existingSet = new Set(existingEmails.map(c => c.email));

// Filter to new contacts
const newContacts = contactsToSave.filter(c => !existingSet.has(c.email));

// Batch create
if (newContacts.length > 0) {
  await prisma.contact.createMany({
    data: newContacts.map(c => ({
      crmId: companyHQId,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
    })),
    skipDuplicates: true, // Handle race conditions
  });
}
```

**Impact**: Reduces N queries to 2 queries (check + create)

**Files to Modify**:
- `app/api/microsoft/email-contacts/save/route.js`
- `app/api/microsoft/contacts/save/route.js`

---

#### 3. Add Progress Indicators
**Problem**: No feedback during long operations
**Solution**: Add progress bars and status messages

**Implementation**:
- Save operation: "Saving contact X of Y..."
- Success page loading: "Loading contact X of Y..."
- Review page: Show progress during API call

**Files to Modify**:
- `app/(authenticated)/contacts/ingest/microsoft/review/page.jsx`
- `app/(authenticated)/contacts/ingest/microsoft/success/page.jsx`
- `app/(authenticated)/contacts/ingest/microsoft/page.jsx`

---

### 🔧 Medium Effort

#### 4. Optimize Review Query
**Current**: Single query with potentially large IN clauses
**Potential Issue**: If user has many companyHQs or selects many contacts

**Check First**: Add database indexes
```sql
-- Check if these indexes exist
CREATE INDEX IF NOT EXISTS idx_contact_email_crmid ON contact(email, crmId);
```

**If Still Slow**: Batch queries (split into chunks of 100 emails)

**Files to Modify**:
- `lib/contactFromPreviewService.js` (checkExistingContacts function)

---

#### 5. Success Page List View
**Problem**: One contact at a time is slow for many contacts
**Solution**: Add list view with inline editing

**Implementation**:
- Toggle between "Detail View" and "List View"
- List view shows all contacts with expandable rows
- Inline editing in list view

**Files to Modify**:
- `app/(authenticated)/contacts/ingest/microsoft/success/page.jsx`

---

### 🎯 Nice to Have

#### 6. Cache Microsoft Graph Responses
**Problem**: Always fetches fresh data (slow)
**Solution**: Cache preview responses with TTL (5-10 minutes)

**Implementation**:
- Use Redis or in-memory cache
- Cache key: `microsoft:preview:${ownerId}:${source}:${skip}`
- TTL: 5-10 minutes
- Invalidate on save

**Files to Modify**:
- `app/api/microsoft/email-contacts/preview/route.js`
- `app/api/microsoft/contacts/preview/route.js`

---

## Recommended Starting Point

**Start with #1 (Batch Contact Loading)** - This is the easiest win with biggest impact.

### Step-by-Step: Batch Contact Loading

1. **Create batch endpoint** (`app/api/contacts/batch/route.js`)
2. **Update success page** to use batch endpoint
3. **Test** with multiple contacts
4. **Measure** improvement (before/after timing)

Then move to #2 (Batch Contact Creation) for similar impact.

---

## Testing Plan

For each improvement:
1. **Measure Before**: Time to complete operation
2. **Implement Change**
3. **Measure After**: Time to complete operation
4. **Compare**: Document improvement

---

## Files Summary

### New Files Needed
- `app/api/contacts/batch/route.js` - Batch contact loading endpoint

### Files to Modify
- `app/(authenticated)/contacts/ingest/microsoft/success/page.jsx` - Use batch endpoint
- `app/api/microsoft/email-contacts/save/route.js` - Batch creation
- `app/api/microsoft/contacts/save/route.js` - Batch creation
- `app/(authenticated)/contacts/ingest/microsoft/review/page.jsx` - Progress indicators
- `app/(authenticated)/contacts/ingest/microsoft/page.jsx` - Progress indicators

---

**Ready to start?** Let's begin with the batch contact loading API!
