# Raw Field Trace - Where Does `raw: false` Come From?

**Date:** 2026-03-03  
**Goal:** Find exact location where `raw` becomes `false` (if it does)

---

## Search Results Summary

### ✅ 1. Prisma Schema - NO Boolean `raw` Field

**File:** `prisma/schema.prisma` (line 678)

```prisma
emailRawText  String?  @db.Text  // Client's literal email (forwarded chains, pasted content)
```

**Finding:** 
- ✅ Field is `String?` (nullable string), NOT Boolean
- ✅ No `@default(false)` 
- ✅ No Boolean coercion possible at schema level

---

### ✅ 2. Database Migration - TEXT Field

**File:** `prisma/migrations/20260301191139_add_email_raw_text/migration.sql`

```sql
ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "emailRawText" TEXT;
```

**Finding:**
- ✅ Column is `TEXT` (PostgreSQL), NOT Boolean
- ✅ No default value set
- ✅ NULL if not provided

---

### ✅ 3. Webhook Handler - NO Boolean Coercion

**File:** `app/api/inbound-email/route.ts`

**Current code (pipe test):**
```typescript
emailRawText: String(payload.raw || ''), // Store 'raw' field if present (DO NOT coerce to boolean)
```

**Finding:**
- ✅ Uses `String()` conversion (string or empty string)
- ✅ NO `Boolean()` coercion
- ✅ NO `raw || false` pattern
- ✅ NO `raw ?? false` pattern

---

### ✅ 4. API Response - Direct Prisma Return

**File:** `app/api/inbound-emails/route.ts` (line 51)

```typescript
select: {
  emailRawText: true,  // Direct field selection
}
```

**Response:**
```typescript
return NextResponse.json({
  success: true,
  emails: inboundEmails,  // Direct Prisma result
});
```

**Finding:**
- ✅ Returns Prisma result directly
- ✅ No transformation layer
- ✅ No serialization that adds `raw: false`

---

### ✅ 5. Frontend - NO Boolean Normalization Found

**File:** `app/(authenticated)/outreach/inbound/page.jsx`

**Usage:**
```typescript
{selectedEmail.emailRawText || '(No raw text)'}
```

**Finding:**
- ✅ Uses `emailRawText` directly (string field)
- ✅ NO `Boolean()` coercion
- ✅ NO `raw ?? false` pattern
- ✅ NO normalization to boolean

---

## ❓ Where Could `raw: false` Come From?

### Possibility 1: SendGrid Webhook Payload

**If SendGrid sends:**
```json
{
  "raw": false  // SendGrid sends boolean false
}
```

**Then:** `String(payload.raw || '')` → `String(false || '')` → `''` (empty string)

**NOT:** `false` (boolean)

---

### Possibility 2: Response Serialization (NOT FOUND)

**Searched for:**
- `raw: false`
- `raw || false`
- `raw ?? false`
- `Boolean(raw)`

**Result:** ❌ No matches found

---

### Possibility 3: Frontend Normalization (NOT FOUND)

**Searched for:**
- `Boolean(emailRawText)`
- `emailRawText ?? false`
- `emailRawText || false`

**Result:** ❌ No matches found

---

### Possibility 4: Database View/Query (NOT FOUND)

**Searched for:**
- SQL views with `raw` field
- Prisma select transformations
- Query builders that add `raw`

**Result:** ❌ No matches found

---

## 🔍 Hypothesis: `raw: false` Doesn't Exist in Our Code

**Conclusion:** Based on comprehensive search:

1. ✅ **Schema:** `emailRawText` is `String?`, NOT Boolean
2. ✅ **Migration:** Column is `TEXT`, NOT Boolean  
3. ✅ **Webhook:** Uses `String()`, NOT Boolean coercion
4. ✅ **API:** Returns Prisma result directly, no transformation
5. ✅ **Frontend:** Uses string field directly, no normalization

**If `raw: false` appears, it's likely:**

### Option A: SendGrid Sends It
- SendGrid webhook payload includes `raw: false` (boolean)
- We convert to string: `String(false)` → `"false"` (string)
- But we use `String(payload.raw || '')` → `''` (empty string)

### Option B: Logging/Display Artifact
- Some logging or UI might show `raw: false` as a display artifact
- But actual DB field is `emailRawText` (string, nullable)

### Option C: Different Model/Table
- There might be a different table/model with Boolean `raw` field
- Not found in `email_activities` model

---

## 📋 Next Steps to Verify

1. **Check SendGrid webhook payload** - Log `payload.raw` type/value
2. **Check database directly** - Query `email_activities.emailRawText` (should be TEXT/NULL)
3. **Check where you're seeing `raw: false`** - Is it in logs? UI? API response?

---

## Files Checked

- ✅ `prisma/schema.prisma` - No Boolean `raw`
- ✅ `app/api/inbound-email/route.ts` - No Boolean coercion
- ✅ `app/api/inbound-emails/route.ts` - Direct Prisma return
- ✅ `app/(authenticated)/outreach/inbound/page.jsx` - String usage
- ✅ All migrations - TEXT field, not Boolean

**No Boolean `raw` field found anywhere in codebase.**
