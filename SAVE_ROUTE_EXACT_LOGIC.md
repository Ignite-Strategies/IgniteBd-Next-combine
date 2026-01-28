# Save Route - Exact Logic (No Kidding)

## The Route: `POST /api/microsoft/email-contacts/save`

**File**: `app/api/microsoft/email-contacts/save/route.js`

## Step-by-Step Logic

### 1. Get Request Body
```javascript
const { previewIds, previewItems, companyHQId } = body;
```

**Input**:
- `previewIds`: `["hash1", "hash2", "hash3"]` - selected preview IDs
- `previewItems`: `[{ previewId: "hash1", email: "joel@example.com", displayName: "Joel Smith", ... }, ...]` - full preview items
- `companyHQId`: `"company-123"` - where to save

### 2. Filter Selected Items
```javascript
const itemsToSave = previewItems.filter(item => 
  previewIds.includes(item.previewId)
);
```

**What it does**: Only keep preview items that were selected
**Result**: Array of preview items to save

### 3. Map Preview → Contact Structure
```javascript
const contactsToSave = itemsToSave.map(item => mapPreviewItemToContact(item));
```

**Function**: `mapPreviewItemToContact(previewItem)`

**Logic**:
```javascript
// 1. Normalize email
const email = previewItem.email.toLowerCase().trim();

// 2. Parse displayName
let firstName = null;
let lastName = null;

if (previewItem.displayName) {
  const nameParts = previewItem.displayName.trim().split(/\s+/);
  if (nameParts.length === 1) {
    firstName = nameParts[0];  // "Joel" → firstName: "Joel"
  } else if (nameParts.length >= 2) {
    firstName = nameParts[0];           // "Joel" → firstName: "Joel"
    lastName = nameParts.slice(1).join(' ');  // "Smith" → lastName: "Smith"
  }
}

return { email, firstName, lastName };
```

**Result**: Array of `{ email, firstName, lastName }` objects

### 4. Save Each Contact (The Actual Save Logic)

```javascript
for (const contactData of contactsToSave) {
  // Step 4a: Validate email
  if (!email || !email.includes('@')) {
    skipped++;
    continue;  // Skip invalid emails
  }

  // Step 4b: Check if already exists
  const existing = await prisma.contact.findFirst({
    where: { 
      email: contactData.email,
      crmId: companyHQId 
    },
  });

  // Step 4c: If exists → skip
  if (existing) {
    skipped++;
    continue;  // Already exists in this companyHQ
  }

  // Step 4d: If NOT exists → CREATE
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

## The "No Kidding" Logic

### Check: `findFirst({ where: { email, crmId } })`

**What it does**:
- Looks for contact with this email AND this companyHQ
- Returns contact if found, `null` if not found

### If `existing` is:
- **`null` (falsy)** → Contact doesn't exist → **CREATE IT** ✅
- **Contact object (truthy)** → Contact exists → **SKIP IT** ❌

### The Logic Flow

```
For each contact:
  1. Validate email format
     → Invalid? Skip
     → Valid? Continue
  
  2. Check: Does contact exist?
     → findFirst({ email, crmId })
     → Returns contact OR null
  
  3. If existing is truthy (contact found)
     → Skip (already exists)
     → Increment skipped counter
  
  4. If existing is falsy (null - not found)
     → CREATE contact
     → Increment saved counter
```

## Example Walkthrough

### Contact 1: "joel@example.com" (New)

```javascript
contactData = { email: "joel@example.com", firstName: "Joel", lastName: "Smith" }

// Check
existing = await prisma.contact.findFirst({
  where: { email: "joel@example.com", crmId: "company-123" }
})
// Returns: null (doesn't exist)

// existing is falsy → CREATE
await prisma.contact.create({
  data: {
    crmId: "company-123",
    email: "joel@example.com",
    firstName: "Joel",
    lastName: "Smith"
  }
})
// saved++ → saved = 1
```

### Contact 2: "adam@example.com" (Already Exists)

```javascript
contactData = { email: "adam@example.com", firstName: "Adam", lastName: "Cole" }

// Check
existing = await prisma.contact.findFirst({
  where: { email: "adam@example.com", crmId: "company-123" }
})
// Returns: { id: "...", email: "adam@example.com", crmId: "company-123", ... }

// existing is truthy → SKIP
if (existing) {
  skipped++;
  continue;  // Don't create
}
// skipped++ → skipped = 1
```

## The Mapper: `mapPreviewItemToContact`

**Location**: `lib/contactFromPreviewService.js`

**Input**:
```javascript
{
  previewId: "abc123",
  email: "Joel@Example.com",
  displayName: "Joel Smith",
  domain: "example.com",
  stats: { ... }
}
```

**Output**:
```javascript
{
  email: "joel@example.com",  // Lowercased, trimmed
  firstName: "Joel",           // First word
  lastName: "Smith"             // Rest of words
}
```

**Rules**:
- Email: Always lowercased and trimmed
- First name: First word of displayName (if exists)
- Last name: All other words joined (if 2+ words)
- Single word: Only firstName, lastName = null

## Error Handling

### Race Condition (Two users import same contact simultaneously)

```javascript
try {
  await prisma.contact.create({ ... });
  saved++;
} catch (error) {
  if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
    // Unique constraint violation - someone else created it
    skipped++;  // Treat as "already exists"
  } else {
    // Other error - log it
    errors.push({ email, error: error.message });
  }
}
```

**P2002 Error**: Unique constraint violation
- Happens if two requests try to create same contact at same time
- We catch it and treat as "skipped" (already exists)

## Summary: The "No Kidding" Route

1. **Filter** selected preview items
2. **Map** preview → `{ email, firstName, lastName }`
3. **For each contact**:
   - Check: `findFirst({ email, crmId })`
   - If `null` (falsy) → **CREATE** ✅
   - If contact (truthy) → **SKIP** ❌
4. **Return**: `{ saved: X, skipped: Y }`

**The Check**: `findFirst` returns contact OR null
**The Logic**: If falsy → good to save, if truthy → skip

---

**Simple Answer**: 
- `findFirst({ email, crmId })` 
- If returns `null` → contact doesn't exist → CREATE IT
- If returns contact → contact exists → SKIP IT
