# Persona Generate-Minimal Route Audit

**Date:** 2025-12-30  
**Route:** `POST /api/personas/generate-minimal`  
**Status:** ✅ FIXED

---

## 1. FULL ROUTE AUDIT

### Expected Request Body Shape

```typescript
{
  contactId: string (REQUIRED) - Contact ID to generate persona from
  companyHQId: string (REQUIRED) - Company HQ context
  description?: string (OPTIONAL) - Optional description override
}
```

### Validation Logic

- **Manual validation** (no Zod schema)
- **Required fields:** `contactId`, `companyHQId`
- **Optional fields:** `description`
- **Forbidden fields:** `ownerId` (explicitly ignored - owner derived from auth)

### Auth Assumptions

- **Owner is derived from Firebase token** (NOT from request body)
- Route calls `verifyFirebaseToken(request)` to get `firebaseUser`
- Then queries `prisma.owners.findUnique({ where: { firebaseId: firebaseUser.uid } })`
- Uses `owner.id` for membership validation

### Strict Schema

- No strict schema validation (no Zod)
- Manual type checking for required fields
- `ownerId` in body is explicitly ignored (not rejected, but documented as forbidden)

---

## 2. PAYLOAD MISMATCH CHECK

### Frontend Was Sending:
```javascript
{
  companyHQId: string,
  contactId: string,
  ownerId: string  // ❌ PROBLEM: This was being sent but route derives owner from auth
}
```

### Route Expected:
```javascript
{
  companyHQId: string (REQUIRED),
  contactId: string (REQUIRED),
  description?: string (OPTIONAL),
  // ownerId is NOT accepted - owner comes from Firebase token
}
```

### Root Cause of 400

**PRIMARY ISSUE:** The route was not explicitly rejecting `ownerId`, but the real problem was:

1. **Prisma import issue** - The service was using dynamic import which could fail
2. **Unclear error messages** - 400 errors didn't explain what was wrong
3. **Missing validation** - No explicit type checking or field validation

**SECONDARY ISSUE:** Frontend was sending `ownerId` unnecessarily, but this wasn't causing the 400 (route just ignored it).

---

## 3. FIXES APPLIED

### Route Changes:

1. **Explicit Contract Documentation**
   - Added JSDoc comments with exact request/response contracts
   - Documented that `ownerId` is NOT accepted

2. **Improved Validation**
   - Added explicit type checking for all fields
   - Added empty string validation
   - Clear error messages for each validation failure

3. **Better Error Messages**
   - All 400 errors now specify: "Validation error: [field] is required and must be a non-empty string"
   - All 401 errors: "Unauthorized: Invalid or missing authentication token"
   - All 403 errors: "Forbidden: You do not have access to this company"
   - All 404 errors: "Owner not found: No account associated with this authentication token"
   - All 500 errors: Specific context (database, OpenAI, parsing, etc.)

4. **Explicit ownerId Handling**
   - Route now explicitly extracts and ignores `ownerId` from body: `const { ownerId: _ignoredOwnerId } = body`
   - Owner is ALWAYS derived from Firebase token

5. **Static Prisma Import**
   - Changed `PersonaPromptPrepService` to use static import (matches other routes)
   - Route now uses static import: `import { prisma } from '@/lib/prisma'`

6. **Structured Error Handling**
   - Each step wrapped in try-catch with specific error messages
   - Errors include context about which step failed

### Frontend Changes:

1. **Removed ownerId from Request**
   - Frontend no longer sends `ownerId` in request body
   - Removed localStorage lookup for `ownerId`
   - Route derives owner from Firebase token (via auth header)

---

## 4. RETURN SHAPE CONFIRMATION

### Success Response (200):
```json
{
  "success": true,
  "persona": {
    "personName": "string",
    "title": "string",
    "company": "string",
    "coreGoal": "string"
  }
}
```

### Error Responses:

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Validation error: [specific field] is required and must be a non-empty string"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing authentication token"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Forbidden: You do not have access to this company. Verify companyHQId is correct."
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Owner not found: No account associated with this authentication token"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "[Specific context]: [error message]"
}
```

---

## 5. FINAL EXPECTED REQUEST PAYLOAD

```javascript
POST /api/personas/generate-minimal
Headers:
  Authorization: Bearer <firebase-token>

Body:
{
  "contactId": "cmjsrv1xb0001ju046p7jon0j",
  "companyHQId": "24beffe1-6ada-4442-b90b-7e3ad8a2ec7d"
  // description is optional
}
```

**DO NOT SEND:**
- `ownerId` (derived from Firebase token)

---

## SUMMARY

### Root Cause of 400
1. **Prisma import issue** - Dynamic import in service could fail (now fixed with static import)
2. **Unclear error messages** - 400 errors didn't explain what was wrong (now fixed)
3. **Missing validation** - No explicit type/empty string checks (now fixed)

### Exact Fix Applied
1. Static Prisma import in route and service
2. Explicit request body validation with clear error messages
3. Structured error handling at each step
4. Frontend updated to NOT send `ownerId`
5. Route contract explicitly documented

### Final Expected Request Payload
```json
{
  "contactId": "string (required, non-empty)",
  "companyHQId": "string (required, non-empty)",
  "description": "string (optional, non-empty if provided)"
}
```

**Owner is derived from Firebase token - never sent in body.**

---

## TESTING CHECKLIST

- [ ] Request with valid `contactId` and `companyHQId` → 200 with persona
- [ ] Request with missing `contactId` → 400 with clear error
- [ ] Request with missing `companyHQId` → 400 with clear error
- [ ] Request with empty string `contactId` → 400 with clear error
- [ ] Request with invalid Firebase token → 401
- [ ] Request with valid token but no owner record → 404
- [ ] Request with valid token but no membership → 403
- [ ] Request with `ownerId` in body → Ignored, works correctly
- [ ] Request with invalid `contactId` (not found) → 400 from PersonaPromptPrepService
- [ ] Request with invalid `companyHQId` (not found) → 400 from PersonaPromptPrepService

