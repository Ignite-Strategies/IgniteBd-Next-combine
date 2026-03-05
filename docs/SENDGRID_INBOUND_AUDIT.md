# SendGrid Inbound Email Webhook Audit

**Date:** 2026-03-03  
**Goal:** Determine whether SendGrid sends "raw" field and if our code mutates/defaults it

---

## 1. Webhook Route Handling

### Current Implementation

**File:** `app/api/inbound-email/route.ts`

**Method:** ✅ `request.formData()` (correct for `multipart/form-data`)

```typescript
const formData = await request.formData();
```

**Status:** ✅ Correctly handling `multipart/form-data` from SendGrid

---

## 2. Raw Payload Logging (Added)

**Location:** Lines 29-60 in `route.ts`

**What we log:**
- ✅ ALL fields SendGrid sends (before any transformation)
- ✅ Field types (string, File, etc.)
- ✅ Field sizes/lengths
- ✅ Explicit check for `raw` field

**Log output:**
```
🔍 AUDIT: RAW INBOUND PAYLOAD FROM SENDGRID
RAW INBOUND PAYLOAD (all fields): {...}
Field keys: [...]
Field types: {...}
🔍 AUDIT: "raw" field check: { exists, type, value }
```

---

## 3. Field Extraction (Current)

**Fields we extract:**
- `from` → string
- `to` → string  
- `subject` → string
- `text` → string
- `html` → string
- `headers` → string
- `envelope` → string (checked but not used in main flow)
- `spam_report` → string (checked but not used)
- `charsets` → string (checked but not used)

**❌ MISSING:** We do NOT check for `raw` field (until audit code added)

---

## 4. emailRawText Construction (Current Flow)

**Current logic (lines 144-171):**

```typescript
// Step 1: Try text or html
let emailRawText = text || html || '';

// Step 2: If empty, reconstruct from headers/envelope
if (!emailRawText) {
  emailRawText = reconstructFromHeaders(headers, envelope, from, to, subject);
}

// Step 3: If still empty, log warning
if (!emailRawText) {
  // Log available fields
}
```

**❌ ISSUE:** We never check for SendGrid's `raw` field!

**After audit code:** Now checks `raw` first, then falls back to text/html/reconstruction.

---

## 5. Mutations/Defaults Check

### ❌ We are NOT defaulting `raw` to false

**We never check for `raw` at all** - so there's no mutation, but also no use of it.

### ✅ We are NOT casting to Boolean

No boolean coercion found. We use:
- `text || html || ''` (string fallback)
- `!!text` (boolean check for logging only)

### ⚠️ We ARE transforming/mutating

**Current:** `emailRawText = text || html || ''` (or reconstructed)

**Problem:** If SendGrid sends `raw` field, we ignore it and use parsed `text`/`html` instead.

---

## 6. SendGrid Fields (Expected vs Actual)

### Expected Fields (from docs)

According to `docs/SENDGRID_INBOUND_PARSE.md`:
- `from`
- `to`
- `subject`
- `text`
- `html`
- `attachments` (count)
- `headers` (mentioned in code)

### Fields We Check

✅ `from`, `to`, `subject`, `text`, `html`, `headers`  
✅ `envelope`, `spam_report`, `charsets` (checked but not used)  
❌ `raw` (NOT checked - **this is the gap**)

### SendGrid "Include Raw" Setting

**Question:** Does SendGrid Inbound Parse send a `raw` field?

**Answer:** SendGrid Inbound Parse can be configured to include raw email content, but it's **not enabled by default**. You must enable "Include Raw" in SendGrid Inbound Parse settings.

**If enabled:** SendGrid sends `raw` field with the full raw email (MIME format).

**If disabled:** SendGrid only sends parsed fields (`text`, `html`, `from`, `to`, etc.).

---

## 7. Audit Findings Summary

### ✅ What's Correct

1. Using `request.formData()` for multipart/form-data ✅
2. Properly handling multipart parsing ✅
3. Not defaulting `raw` to false (we just don't check it) ✅
4. Not casting to Boolean ✅

### ❌ What's Missing

1. **We never check for `raw` field** - if SendGrid sends it, we ignore it
2. **We reconstruct from headers** when text/html empty - but this is a workaround, not the real raw email
3. **No logging of `raw` field** until audit code added

### ⚠️ What Needs Fixing

1. **Check for `raw` field first** - if SendGrid sends it, use it directly
2. **Enable "Include Raw" in SendGrid** - if you want the full raw email
3. **Fallback logic** - if `raw` not present, use text/html/reconstruction (current behavior)

---

## 8. Recommended Fix

### Priority 1: Use `raw` field if present

```typescript
// Check for SendGrid "raw" field first (if "Include Raw" enabled)
const raw = typeof formData.get('raw') === 'string' ? formData.get('raw') as string : null;

let emailRawText: string;
if (raw) {
  // SendGrid sent raw email - use it directly (no transformation)
  emailRawText = raw;
} else {
  // Fallback: use text/html or reconstruct
  emailRawText = text || html || reconstructFromHeaders(...);
}
```

### Priority 2: Enable "Include Raw" in SendGrid

**SendGrid Dashboard:**
1. Settings → Inbound Parse
2. Edit your inbound parse configuration
3. Enable **"Include Raw"** checkbox
4. Save

**Result:** SendGrid will send `raw` field with full MIME email content.

---

## 9. Next Steps

1. ✅ **Audit logging added** - will show what SendGrid actually sends
2. ⏳ **Test with forwarded email** - check logs for `raw` field
3. ⏳ **If `raw` present:** Use it directly (no transformation)
4. ⏳ **If `raw` NOT present:** Enable "Include Raw" in SendGrid settings
5. ⏳ **Verify:** Forwarded emails should have full content in `raw` field

---

## 10. Current Parsing Flow (After Audit Code)

```
1. Receive webhook → request.formData()
2. Log ALL fields (audit)
3. Check for "raw" field
4. If raw exists → use it directly
5. If raw missing → use text || html || reconstruct
6. Save emailRawText to DB
7. Parse async (AI)
8. Update record with parsed fields
```

---

## Conclusion

**Current state:** We're NOT checking for SendGrid's `raw` field, so we're using parsed `text`/`html` which may be empty for forwarded emails.

**Root cause:** Forwarded emails might not have `text`/`html` extracted properly by SendGrid, but the `raw` field (if enabled) would contain the full email.

**Solution:** 
1. Check for `raw` field first (audit code added)
2. Enable "Include Raw" in SendGrid Inbound Parse settings
3. Use `raw` when available, fallback to text/html when not
