# Microsoft Email Contacts - Complete Flow Analysis

## Overview

This document analyzes the complete flow of the Microsoft email contacts import feature to understand how it works, identify issues, and propose improvements.

## Current Architecture

### 1. Preview API - How It Works

**Endpoint**: `GET /api/microsoft/email-contacts/preview`

**Flow**:
1. ✅ Check Redis cache first (45 min TTL)
2. ✅ If cached → return immediately
3. ✅ If not cached:
   - Fetch **100 messages** from Microsoft Graph (`/me/messages?$top=100`)
   - Process all messages
   - Filter out automated/business emails
   - Aggregate unique contacts by email
   - **Early exit at 50 unique contacts** (performance optimization)
   - Store in Redis
   - Return 50 contacts

**Key Points**:
- ❌ **NOT paginated** - fetches 100 messages, returns 50 contacts
- ❌ **No "next batch"** - always fetches same 100 messages
- ✅ **Cached in Redis** - 45 minute TTL
- ✅ **Early exit** - stops at 50 contacts (performance)

**Microsoft Graph API Call**:
```javascript
GET https://graph.microsoft.com/v1.0/me/messages
  ?$select=from,receivedDateTime
  &$top=100
  &$orderby=receivedDateTime desc
```

**Returns**:
```json
{
  "success": true,
  "generatedAt": "2025-01-26T...",
  "limit": 50,
  "items": [
    {
      "previewId": "hash_of_email",
      "email": "user@example.com",
      "displayName": "John Doe",
      "domain": "example.com",
      "stats": {
        "firstSeenAt": "2025-01-20T...",
        "lastSeenAt": "2025-01-26T...",
        "messageCount": 5
      }
    }
  ]
}
```

### 2. Save API - How It Works

**Endpoint**: `POST /api/microsoft/email-contacts/save`

**Flow**:
1. ✅ Verify authentication
2. ✅ Validate `previewIds` array and `companyHQId`
3. ✅ Check membership
4. ✅ Load preview from Redis (same key as preview)
5. ✅ Filter items by `previewIds`
6. ✅ For each item:
   - Parse `displayName` into `firstName`/`lastName`
   - Check if contact exists (by email)
   - If exists → skip
   - If not exists → create Contact record
7. ✅ Return counts: `saved`, `skipped`

**Body**:
```json
{
  "previewIds": ["hash1", "hash2", "hash3"],
  "companyHQId": "required"
}
```

**Returns**:
```json
{
  "success": true,
  "saved": 3,
  "skipped": 1,
  "message": "Saved 3 contacts"
}
```

### 3. Frontend Flow

**User Journey**:
1. User clicks "Ingest from Emails" card
2. Frontend calls `/api/microsoft/email-contacts/preview`
3. Shows 50 contacts in preview table
4. User selects contacts (checkboxes)
5. User clicks "Import Selected"
6. Frontend calls `/api/microsoft/email-contacts/save` with `previewIds`
7. Shows success message with "Import Next 50" button

**"Import Next 50" Button**:
- ❌ **Does NOT paginate** - just calls `handleLoadPreview()` again
- ❌ **Fetches same 100 messages** - gets same 50 contacts (or different if messages changed)
- ❌ **No skip/offset** - always starts from most recent 100 messages

## Issues Identified

### Issue 1: No Real Pagination ❌

**Problem**:
- "Import Next 50" button doesn't actually get the next 50 contacts
- It just refreshes the preview, which fetches the same 100 messages
- User can't see contacts beyond the first 50

**Current Behavior**:
```
Click "Import Next 50"
  → Calls handleLoadPreview()
  → Fetches same 100 messages
  → Returns same 50 contacts (or different if messages changed)
```

**What User Expects**:
```
Click "Import Next 50"
  → Gets next 50 contacts (from messages 101-200, or next batch)
  → Shows different contacts
```

### Issue 2: One-Shot Fetch ❌

**Problem**:
- Fetches 100 messages in one API call
- No pagination support from Microsoft Graph
- Can't get more than what's in those 100 messages

**Microsoft Graph Limitations**:
- Graph API supports `$skip` and `$top` for pagination
- But we're not using it - just fetching top 100

### Issue 3: Redis Cache Blocks Fresh Data ❌

**Problem**:
- Preview cached for 45 minutes
- "Import Next 50" might return cached data (same 50 contacts)
- User can't get next batch until cache expires

### Issue 4: No Tracking of Processed Messages ❌

**Problem**:
- No way to track which messages we've already processed
- "Import Next 50" might show same contacts if messages haven't changed
- No skip mechanism for already-imported contacts

## How It Should Work

### Option 1: True Pagination (Recommended)

**Flow**:
1. Fetch messages with pagination: `$top=100&$skip=0` (first batch)
2. Process, filter, return 50 contacts
3. Store `skip` offset in Redis or state
4. "Import Next 50" → fetch `$top=100&$skip=100` (next batch)
5. Continue until no more messages

**Implementation**:
```javascript
// Preview API accepts skip parameter
GET /api/microsoft/email-contacts/preview?skip=0  // First 50
GET /api/microsoft/email-contacts/preview?skip=100 // Next 50
```

**Redis Key**:
```javascript
// Store per-batch cache
`preview:microsoft_email:${ownerId}:skip:${skip}`
```

### Option 2: Fetch More Messages Upfront

**Flow**:
1. Fetch 500 messages (instead of 100)
2. Process all, return first 50
3. Store all processed contacts in Redis
4. "Import Next 50" → return next 50 from cache
5. Continue until cache exhausted, then fetch more

**Pros**:
- Fewer API calls
- Faster "next batch" (from cache)

**Cons**:
- Larger initial fetch (slower)
- More memory usage

### Option 3: Track Processed Emails

**Flow**:
1. Fetch 100 messages
2. Process, filter, return 50 contacts
3. Store processed email addresses in Redis
4. "Import Next 50" → fetch 100 more, filter out already-processed
5. Return next 50 unique contacts

**Implementation**:
```javascript
// Track processed emails
`processed:microsoft_email:${ownerId}` = Set of email addresses
```

## Current Save Flow

### How Selection Works

1. **User selects contacts** (checkboxes)
   - Frontend stores `previewId` in `selectedIds` Set
   - `previewId` = hash of email address

2. **User clicks "Import Selected"**
   - Frontend calls `POST /api/microsoft/email-contacts/save`
   - Sends `previewIds: Array.from(selectedIds)`

3. **Save API**:
   - Loads preview from Redis
   - Filters items by `previewIds`
   - Creates Contact records for selected items
   - Skips if email already exists

### How Save Works

**Code Flow**:
```javascript
// 1. Load preview from Redis
const previewData = await redisClient.get(`preview:microsoft_email:${ownerId}`);

// 2. Filter by previewIds
const itemsToSave = previewData.items.filter(item => 
  previewIds.includes(item.previewId)
);

// 3. For each item:
for (const item of itemsToSave) {
  // Check if exists
  const existing = await prisma.contact.findUnique({ where: { email } });
  if (existing) {
    skipped++;
    continue;
  }
  
  // Create contact
  await prisma.contact.create({
    data: {
      crmId: companyHQId,
      email,
      firstName, // Parsed from displayName
      lastName,  // Parsed from displayName
    }
  });
}
```

## Data Flow Diagram

```
User clicks "Ingest from Emails"
  ↓
Frontend: handleLoadPreview('email')
  ↓
GET /api/microsoft/email-contacts/preview
  ↓
Check Redis: preview:microsoft_email:${ownerId}
  ├─ Hit → Return cached (50 contacts)
  └─ Miss → Continue
      ↓
Get Microsoft Access Token
  ↓
Fetch 100 messages from Microsoft Graph
  GET /v1.0/me/messages?$top=100&$orderby=receivedDateTime desc
  ↓
Process messages:
  - Filter automated/business emails
  - Aggregate unique contacts
  - Early exit at 50 contacts
  ↓
Store in Redis (45 min TTL)
  ↓
Return 50 contacts to frontend
  ↓
Frontend displays preview table
  ↓
User selects contacts (checkboxes)
  ↓
User clicks "Import Selected"
  ↓
POST /api/microsoft/email-contacts/save
  Body: { previewIds: [...], companyHQId: "..." }
  ↓
Load preview from Redis
  ↓
Filter items by previewIds
  ↓
For each selected contact:
  - Check if email exists
  - If not exists → Create Contact
  - If exists → Skip
  ↓
Return: { saved: X, skipped: Y }
  ↓
Frontend shows success + "Import Next 50" button
  ↓
"Import Next 50" → Calls handleLoadPreview() again
  ❌ PROBLEM: Fetches same 100 messages, returns same 50 contacts
```

## Problems Summary

### 1. No Real Pagination ❌

**Current**: "Import Next 50" just refreshes, gets same data
**Needed**: Actual pagination to get next batch

### 2. Limited to 100 Messages ❌

**Current**: Only fetches top 100 messages
**Needed**: Support for more messages (pagination or larger fetch)

### 3. Cache Blocks Fresh Data ❌

**Current**: 45 min cache means "next 50" might return cached data
**Needed**: Cache per batch, or skip parameter to bypass cache

### 4. No Tracking of Processed ❌

**Current**: Can't track which emails we've already processed
**Needed**: Track processed emails to avoid duplicates

## Proposed Solutions

### Solution 1: Add Skip Parameter (Recommended)

**Preview API**:
```javascript
GET /api/microsoft/email-contacts/preview?skip=0   // First 50
GET /api/microsoft/email-contacts/preview?skip=100 // Next 50
```

**Implementation**:
- Add `skip` query parameter
- Use in Microsoft Graph: `$top=100&$skip=${skip}`
- Cache per skip: `preview:microsoft_email:${ownerId}:skip:${skip}`
- Frontend tracks current skip value

**Frontend**:
```javascript
const [skip, setSkip] = useState(0);

// "Import Next 50" button
onClick={() => {
  setSkip(skip + 100);
  handleLoadPreview(source, skip + 100);
}}
```

### Solution 2: Fetch More Messages Upfront

**Preview API**:
- Fetch 500 messages (instead of 100)
- Process all, store in Redis
- Return first 50
- "Next 50" returns from cache

**Pros**: Fewer API calls, faster "next"
**Cons**: Slower initial load, more memory

### Solution 3: Track Processed Emails

**Implementation**:
- Store processed email addresses in Redis Set
- "Next 50" filters out already-processed
- Fetches fresh 100 messages each time

**Pros**: Always fresh data
**Cons**: More API calls, might show duplicates

## Recommendation

**Implement Solution 1: Skip Parameter**

**Why**:
- ✅ True pagination
- ✅ Can access all messages (not just 100)
- ✅ Clear user experience
- ✅ Efficient (cache per batch)

**Implementation Steps**:
1. Add `skip` parameter to preview API
2. Use `$skip` in Microsoft Graph query
3. Cache per skip value
4. Frontend tracks skip, increments on "Next 50"
5. Update "Import Next 50" button to use skip

## Questions to Answer

1. **How many messages should we fetch per batch?**
   - Current: 100 messages → 50 contacts
   - Should we fetch more? (200, 500?)

2. **How should we handle the cache?**
   - Per-batch cache? (skip:0, skip:100, etc.)
   - Or single cache with all batches?

3. **Should we track processed emails?**
   - To avoid showing already-imported contacts?
   - Or let user see them (they'll be skipped on save)?

4. **What's the max we should fetch?**
   - Microsoft Graph supports pagination
   - Should we limit to first 1000 messages? 5000?

---

**Status**: Analysis complete - ready for implementation decisions
