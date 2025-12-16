# Contact Routes Audit
## Complete Route Structure Analysis

### Route Structure

```
src/app/api/contacts/
├── route.js                          # GET all contacts, POST create contact
├── [contactId]/
│   ├── route.js                      # GET/PUT/DELETE single contact
│   └── generate-portal-access/
│       └── route.js                  # POST generate portal access
├── by-email/
│   └── route.js                      # GET contact by email
├── by-firebase-uid/
│   └── route.js                      # GET contact by Firebase UID
├── cleanup-duplicates/
│   └── route.js                      # POST cleanup duplicate contacts
└── enrich/
    ├── route.ts                      # POST enrich existing contact
    ├── save/route.ts                 # POST save enriched contact
    └── ... (other enrichment routes)
```

---

## Route Details

### 1. `/api/contacts` (route.js)

**GET /api/contacts**
- **Purpose**: List all contacts for a companyHQ
- **Query Params**: `companyHQId` (required), `pipeline`, `stage`
- **Returns**: Array of contacts with pipeline and company relations
- **Status**: ✅ Uses `prisma.contact` (correct)

**POST /api/contacts**
- **Purpose**: Create or update a contact
- **Body**: Contact fields (firstName, lastName, email, etc.)
- **Logic**:
  1. Validates crmId (companyHQId)
  2. Handles company association (by name or domain)
  3. If email provided: checks for existing contact by email
     - If exists: Updates contact
     - If not: Creates new contact
  4. If no email: Creates new contact without email
  5. Ensures pipeline exists
- **Bug Found**: ❌ Line 315 uses `prisma.contacts` (should be `prisma.contact`)
- **Status**: 🔧 Fixed in this audit

---

### 2. `/api/contacts/cleanup-duplicates` (cleanup-duplicates/route.js)

**POST /api/contacts/cleanup-duplicates**
- **Purpose**: Remove duplicate contacts based on email address
- **Query Params**: `companyHQId` (required)
- **Logic**:
  1. Fetches all contacts with emails for the companyHQ
  2. Groups contacts by normalized email (lowercase, trimmed)
  3. For each group with duplicates:
     - Keeps the first contact (oldest by createdAt)
     - Deletes all other duplicates
  4. Returns count of deleted and kept contacts
- **Use Case**: Cleanup utility for data hygiene
- **Status**: ✅ Uses `prisma.contact` (correct)

---

### 3. `/api/contacts/[contactId]` ([contactId]/route.js)

**GET /api/contacts/[contactId]**
- **Purpose**: Get single contact by ID
- **Returns**: Contact with pipeline, company relations
- **Status**: ✅ Uses `prisma.contact` (correct)

**PUT /api/contacts/[contactId]**
- **Purpose**: Update existing contact
- **Body**: Partial contact fields
- **Status**: ✅ Uses `prisma.contact` (correct)

**DELETE /api/contacts/[contactId]**
- **Purpose**: Delete contact
- **Status**: ✅ Uses `prisma.contact` (correct)

---

### 4. `/api/contacts/by-email` (by-email/route.js)

**GET /api/contacts/by-email**
- **Purpose**: Get contact by email (for client portal login)
- **Query Params**: `email` (required)
- **Auth**: Optional (allows unauthenticated access)
- **Status**: ✅ Uses `prisma.contact` (correct)

---

### 5. `/api/contacts/by-firebase-uid` (by-firebase-uid/route.js)

**GET /api/contacts/by-firebase-uid**
- **Purpose**: Get contact by Firebase UID (for client portal)
- **Query Params**: Firebase UID from auth token
- **Status**: ✅ Uses `prisma.contact` (correct)

---

### 6. `/api/contacts/[contactId]/generate-portal-access` (generate-portal-access/route.js)

**POST /api/contacts/[contactId]/generate-portal-access**
- **Purpose**: Generate client portal access for a contact
- **Logic**:
  1. Creates Firebase user if doesn't exist
  2. Updates contact with firebaseUid
  3. Generates invite token and activation link
- **Status**: ✅ Uses `prisma.contact` (correct)

---

### 7. `/api/contacts/enrich` (enrich/route.ts)

**POST /api/contacts/enrich**
- **Purpose**: Enrich existing contact with Apollo data
- **Body**: `contactId`, `email` or `linkedinUrl`
- **Returns**: Preview of enriched data (stored in Redis)
- **Status**: ✅ Uses `prisma.contact` (correct)

---

## Summary

### Contact Create Route

**The contact create route is in `/api/contacts` (route.js), POST method (lines 74-341)**

It handles:
- Creating new contacts
- Updating existing contacts (if email matches)
- Company association logic
- Pipeline creation

### Issues Found

1. ❌ **Line 315 in route.js**: Uses `prisma.contacts` instead of `prisma.contact`
   - **Status**: 🔧 Fixed in this audit

2. ⚠️ **cleanup-duplicates route**: Utility function, not a core CRUD operation
   - **Purpose**: Data cleanup utility for removing duplicate contacts
   - **Not a bug**: This is intentional functionality

### All Routes Status

| Route | Method | Prisma Usage | Status |
|-------|--------|--------------|--------|
| `/api/contacts` | GET | `prisma.contact` | ✅ Correct |
| `/api/contacts` | POST | `prisma.contact` | 🔧 Fixed (line 315) |
| `/api/contacts/[contactId]` | GET/PUT/DELETE | `prisma.contact` | ✅ Correct |
| `/api/contacts/cleanup-duplicates` | POST | `prisma.contact` | ✅ Correct |
| `/api/contacts/by-email` | GET | `prisma.contact` | ✅ Correct |
| `/api/contacts/by-firebase-uid` | GET | `prisma.contact` | ✅ Correct |
| `/api/contacts/[contactId]/generate-portal-access` | POST | `prisma.contact` | ✅ Correct |
| `/api/contacts/enrich/*` | POST | `prisma.contact` | ✅ Correct |

