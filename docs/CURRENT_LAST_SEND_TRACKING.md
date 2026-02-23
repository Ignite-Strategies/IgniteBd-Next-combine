# Current "Last Send" Tracking Analysis

**Date:** February 11, 2026  
**Question:** How do we currently track "last send" and is there a manual way to log it?

---

## Current State

### 1. Email Activities Model (Automatic Tracking)

**Location:** `email_activities` table

**Fields:**
- `contact_id` (String?) - Links to Contact
- `createdAt` (DateTime) - When email was sent
- `email`, `subject`, `body` - Email content
- `event` (String?) - Usually "sent"
- `messageId` (String, unique)

**How it works:**
- When email is sent via `/api/outreach/send`, it automatically creates an `email_activities` record
- Stores `contact_id` and `createdAt` timestamp
- **NO automatic update** to Contact model

**Example:**
```javascript
// In /api/outreach/send/route.js
await prisma.email_activities.create({
  data: {
    owner_id: owner.id,
    contact_id: customArgs.contactId || null,  // ← Links to contact
    email: toEmail,
    subject: subject,
    body: emailBody,
    event: 'sent',
    // createdAt is auto-set
  },
});
```

---

### 2. Contact Model (Manual Tracking)

**Current fields on Contact:**
- ❌ **NO** `lastContact` field
- ❌ **NO** `lastSendDate` field  
- ❌ **NO** `lastOutreach` field
- ✅ `notes` (String?) - Free text, could manually note "Last contacted Aug 2025"
- ✅ `last_outreach_date` (DateTime?) - **JUST ADDED** but not populated automatically

**Manual logging options:**
1. Use `notes` field - free text like "Last contacted Aug 2025"
2. Use `last_outreach_date` - DateTime field (requires date parsing)

---

### 3. How to Get "Last Send" Currently

**Option A: Query email_activities**
```javascript
// Get most recent email for a contact
const lastEmail = await prisma.email_activities.findFirst({
  where: {
    contact_id: contactId,
  },
  orderBy: {
    createdAt: 'desc',
  },
});

const lastSendDate = lastEmail?.createdAt; // DateTime or null
```

**Option B: Manual field (doesn't exist yet)**
```javascript
// Would be simple if it existed:
const lastContact = contact.lastContact; // "Aug 2025" or null
```

---

## Gap Analysis

### What's Missing

1. **No direct field on Contact** for quick access
   - Must query `email_activities` table separately
   - Requires join/query every time you need "last send"

2. **No manual logging mechanism**
   - Can't manually set "I reached out Aug 2025" without:
     - Parsing date string → DateTime
     - Or using free-text `notes` field

3. **No relation from Contact → email_activities**
   - Can't easily access: `contact.email_activities`
   - Must manually query by `contact_id`

---

## Proposed Simple Solution

### Add `lastContact` String? field to Contact

**Why String instead of DateTime?**
- ✅ Simple manual entry: "Aug 2025", "Last week", "2024-12-15"
- ✅ No date parsing required
- ✅ User-friendly (matches how users think: "I reached out Aug 2025")
- ✅ Flexible (can be "Last month", "3 months ago", exact date, etc.)

**Schema addition:**
```prisma
model Contact {
  // ... existing fields ...
  lastContact String? // Manual: "Aug 2025", "Last week", etc.
  // ... rest of fields ...
}
```

**Usage:**
```javascript
// Manual update
await prisma.contact.update({
  where: { id: contactId },
  data: {
    lastContact: "Aug 2025" // Simple string
  }
});

// Display
<div>Last contacted: {contact.lastContact || "Never"}</div>
```

---

## Comparison: Current vs Proposed

| Aspect | Current (email_activities) | Proposed (lastContact String?) |
|-------|---------------------------|--------------------------------|
| **Automatic?** | ✅ Yes (when email sent) | ❌ No (manual) |
| **On Contact?** | ❌ No (separate table) | ✅ Yes (direct field) |
| **Manual entry?** | ❌ No | ✅ Yes (simple string) |
| **Query complexity** | Requires join/query | Direct field access |
| **Date format** | DateTime (strict) | String (flexible) |
| **Use case** | System-tracked emails | User memory ("Aug 2025") |

---

## Recommendation

**Add simple `lastContact String?` field:**

1. **Simple** - Just a string field, no parsing
2. **Manual** - User controls what goes in it
3. **Flexible** - Can be "Aug 2025", "Last week", exact date, etc.
4. **Quick access** - Direct field on Contact, no query needed
5. **Backward compatible** - Optional field, doesn't break existing code

**Keep both:**
- `email_activities` for automatic system tracking
- `lastContact` for manual user notes

**Example workflow:**
```
User: "I reached out to him Aug 2025"
→ Set lastContact = "Aug 2025" (manual)
→ System can still query email_activities for exact DateTime if needed
→ Display shows: "Last contacted: Aug 2025"
```

---

## Implementation

**Minimal change:**
```prisma
model Contact {
  // ... existing fields ...
  lastContact String? // Manual outreach note: "Aug 2025", "Last week", etc.
  // ... rest ...
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_lastContact_field
```

**That's it!** Simple string field for manual logging.
