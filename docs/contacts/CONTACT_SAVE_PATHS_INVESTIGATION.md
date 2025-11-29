# Contact Save Paths - Complete Investigation

## Purpose

This document lists **ALL** code paths that create or update Contact records in the system. This is critical for implementing the universal rule: **Every Contact must have a Pipeline record**.

---

## Core Rule

**A Contact is not fully valid unless it has a Pipeline record.**

This means:
- ✅ No enrichment should save without pipeline
- ✅ No contact creation should save without pipeline
- ✅ No CSV import should save without pipeline
- ✅ No Outlook import should save without pipeline

---

## Investigation Results

### A. Enrichment Save

**File**: `src/app/api/contacts/enrich/save/route.ts`  
**Method**: `POST`  
**Endpoint**: `/api/contacts/enrich/save`

**Current Behavior**:
- ✅ Creates/updates Contact with enrichment data
- ❌ **DOES NOT create Pipeline** (contact has no pipeline after save)
- ❌ **DOES NOT require pipeline+stage** in request body

**Pipeline Handling**: 
- **Current**: None
- **Should Be**: **REQUIRED** - Create default `prospect` + `interest` if not provided

**Status**: 🔴 **NEEDS FIX**

**Code Location**:
```typescript
// Line 300: Contact is updated but no pipeline creation
const updatedContact = await prisma.contact.update({
  where: { id: contactId },
  data: contactUpdateData,
  include: {
    pipeline: true, // Includes but doesn't create
  },
});
```

**Recommended Fix**:
```typescript
// After contact update, ensure pipeline exists
if (!updatedContact.pipeline) {
  await prisma.pipeline.upsert({
    where: { contactId: updatedContact.id },
    create: {
      contactId: updatedContact.id,
      pipeline: 'prospect',
      stage: 'interest',
    },
    update: {}, // Pipeline already exists
  });
}
```

---

### B. Manual Contact Creation

**File**: `src/app/api/contacts/route.js`  
**Method**: `POST`  
**Endpoint**: `/api/contacts`

**Current Behavior**:
- ✅ Creates Contact
- ⚠️ **OPTIONALLY creates Pipeline** (only if `pipeline` and `stage` provided in body)
- ❌ **DOES NOT require pipeline+stage** - can create contact without pipeline

**Pipeline Handling**:
- **Current**: Optional (only creates if `pipeline` field provided)
- **Should Be**: **REQUIRED** - Default to `prospect` + `interest` if not provided

**Status**: 🟡 **NEEDS FIX** (partially works but not required)

**Code Location**:
```javascript
// Lines 247-254: Pipeline only created if pipeline field provided
...(pipeline && {
  pipeline: {
    create: {
      pipeline,
      stage: stage || null,
    },
  },
}),
```

**Recommended Fix**:
```javascript
// Always create pipeline, default to prospect/interest if not provided
pipeline: {
  create: {
    pipeline: pipeline || 'prospect',
    stage: stage || 'interest',
  },
},
```

---

### C. Universal Contact Create

**File**: `src/app/api/contacts/universal-create/route.js`  
**Method**: `POST`  
**Endpoint**: `/api/contacts/universal-create`

**Current Behavior**:
- ✅ Creates Contact + Company + Pipeline (if provided)
- ⚠️ **OPTIONALLY creates Pipeline** (only if `pipelineData.pipeline` provided)
- ❌ **DOES NOT require pipeline+stage** - can create contact without pipeline

**Pipeline Handling**:
- **Current**: Optional (only creates if `pipelineData.pipeline` provided)
- **Should Be**: **REQUIRED** - Default to `prospect` + `interest` if not provided

**Status**: 🟡 **NEEDS FIX** (partially works but not required)

**Code Location**:
```javascript
// Lines 178-185: Pipeline only created if pipelineData.pipeline provided
...(pipelineData && pipelineData.pipeline && {
  pipeline: {
    create: {
      pipeline: pipelineData.pipeline,
      stage: pipelineData.stage || null,
    },
  },
}),
```

**Recommended Fix**:
```javascript
// Always create pipeline, default to prospect/interest if not provided
pipeline: {
  create: {
    pipeline: pipelineData?.pipeline || 'prospect',
    stage: pipelineData?.stage || 'interest',
  },
},
```

---

### D. Contact Update

**File**: `src/app/api/contacts/[contactId]/route.js`  
**Method**: `PUT`  
**Endpoint**: `/api/contacts/[contactId]`

**Current Behavior**:
- ✅ Updates Contact fields
- ✅ Updates Pipeline (if `pipeline` or `stage` provided in body)
- ⚠️ **OPTIONALLY creates Pipeline** (only if `pipeline` or `stage` provided)
- ❌ **DOES NOT require pipeline+stage** - can update contact without ensuring pipeline exists

**Pipeline Handling**:
- **Current**: Optional (only updates/creates if `pipeline` or `stage` provided)
- **Should Be**: **REQUIRED** - Ensure pipeline exists after update (create if missing)

**Status**: 🟡 **NEEDS FIX** (updates work but doesn't ensure existence)

**Code Location**:
```javascript
// Lines 208-237: Pipeline only updated/created if pipeline or stage provided
if (pipeline !== undefined || stage !== undefined) {
  // ... pipeline upsert
}
```

**Recommended Fix**:
```javascript
// Always ensure pipeline exists after contact update
const currentPipeline = await prisma.pipeline.findUnique({
  where: { contactId },
});

if (!currentPipeline) {
  // Create default pipeline if missing
  await prisma.pipeline.create({
    data: {
      contactId,
      pipeline: pipeline || 'prospect',
      stage: stage || 'interest',
    },
  });
} else if (pipeline !== undefined || stage !== undefined) {
  // Update pipeline if provided
  await prisma.pipeline.upsert({
    where: { contactId },
    update: {
      pipeline: pipeline || currentPipeline.pipeline,
      stage: stage !== undefined ? stage : currentPipeline.stage,
    },
    create: {
      contactId,
      pipeline: pipeline || 'prospect',
      stage: stage || 'interest',
    },
  });
}
```

---

### E. Contact Service (Upsert)

**File**: `src/lib/services/contactService.ts`  
**Function**: `upsertContactWithDomain()`  
**Used By**: Various services

**Current Behavior**:
- ✅ Upserts Contact by email
- ❌ **DOES NOT create Pipeline**
- ❌ **DOES NOT require pipeline+stage**

**Pipeline Handling**:
- **Current**: None
- **Should Be**: **REQUIRED** - Create default `prospect` + `interest` after upsert

**Status**: 🔴 **NEEDS FIX**

**Code Location**:
```typescript
// Line 127: Contact upserted but no pipeline creation
const contact = await prisma.contact.upsert({
  where: { email: normalizedEmail },
  update: { ...updateData },
  create: upsertData,
  include: {
    pipeline: true, // Includes but doesn't create
  },
});
```

**Recommended Fix**:
```typescript
// After upsert, ensure pipeline exists
if (!contact.pipeline) {
  await prisma.pipeline.upsert({
    where: { contactId: contact.id },
    create: {
      contactId: contact.id,
      pipeline: 'prospect',
      stage: 'interest',
    },
    update: {},
  });
}
```

---

### F. CSV Import

**Status**: 🟠 **NOT YET IMPLEMENTED**

**File**: `src/components/workpackages/CSVImportWizard.jsx`  
**Current State**: Placeholder/TODO

**Planned Behavior**:
- Should import contacts from CSV
- **MUST require pipeline+stage** for each imported row
- **MUST create Pipeline** for each imported contact

**Pipeline Handling**:
- **Current**: Not implemented
- **Should Be**: **REQUIRED** - Each CSV row must specify pipeline+stage (or default to `prospect` + `interest`)

**Status**: 🔴 **NEEDS IMPLEMENTATION**

**Recommended Implementation**:
```typescript
// For each CSV row:
const contact = await prisma.contact.create({
  data: {
    // ... contact fields from CSV
    pipeline: {
      create: {
        pipeline: row.pipeline || 'prospect',
        stage: row.stage || 'interest',
      },
    },
  },
});
```

---

### G. Microsoft/Outlook Contact Import

**File**: `src/app/(authenticated)/contacts/enrich/microsoft/page.jsx`  
**Current State**: Placeholder/TODO (enrichment not implemented)

**Planned Behavior**:
- Should import contacts from Microsoft Graph
- **MUST require pipeline+stage** for each imported contact
- **MUST create Pipeline** for each imported contact

**Pipeline Handling**:
- **Current**: Not implemented (enrichment is TODO)
- **Should Be**: **REQUIRED** - Each imported contact must have pipeline (default to `prospect` + `interest`)

**Status**: 🔴 **NEEDS IMPLEMENTATION**

**Recommended Implementation**:
```typescript
// When importing Microsoft contacts:
const contact = await prisma.contact.create({
  data: {
    // ... contact fields from Microsoft Graph
    pipeline: {
      create: {
        pipeline: 'prospect', // Default for imported contacts
        stage: 'interest',
      },
    },
  },
});
```

---

### H. Other Contact Updates (Non-CRM)

**These endpoints update contacts but are NOT CRM contact creation paths:**

1. **Set Password** (`src/app/api/set-password/route.js`)
   - Updates `firebaseUid`, `isActivated`, `activatedAt`
   - **Pipeline**: Not applicable (activation flow)

2. **Invite Send** (`src/app/api/invite/send/route.js`)
   - Updates `firebaseUid`, `isActivated`
   - **Pipeline**: Not applicable (invite flow)

3. **Proposal Approve** (`src/app/api/proposals/[proposalId]/approve/route.js`)
   - Updates contact fields related to proposal
   - **Pipeline**: Should trigger pipeline update (prospect → client conversion)

4. **Generate Portal Access** (`src/app/api/contacts/[contactId]/generate-portal-access/route.js`)
   - Updates `firebaseUid`, `isActivated`
   - **Pipeline**: Not applicable (portal activation)

5. **Promotion Service** (`src/lib/services/promotion.js`)
   - Updates contact role/owner status
   - **Pipeline**: Not applicable (owner elevation)

**Status**: ✅ **OK** - These are not CRM contact creation paths

---

## Summary Table

| Endpoint/Service | File | Method | Creates Contact? | Creates Pipeline? | Pipeline Required? | Status |
|----------------|------|--------|------------------|-------------------|-------------------|--------|
| **A. Enrichment Save** | `src/app/api/contacts/enrich/save/route.ts` | POST | ✅ Yes | ❌ No | 🔴 **REQUIRED** | 🔴 **NEEDS FIX** |
| **B. Manual Create** | `src/app/api/contacts/route.js` | POST | ✅ Yes | ⚠️ Optional | 🔴 **REQUIRED** | 🟡 **NEEDS FIX** |
| **C. Universal Create** | `src/app/api/contacts/universal-create/route.js` | POST | ✅ Yes | ⚠️ Optional | 🔴 **REQUIRED** | 🟡 **NEEDS FIX** |
| **D. Contact Update** | `src/app/api/contacts/[contactId]/route.js` | PUT | ❌ No (updates) | ⚠️ Optional | 🟡 **SHOULD ENSURE** | 🟡 **NEEDS FIX** |
| **E. Contact Service** | `src/lib/services/contactService.ts` | Function | ✅ Yes (upsert) | ❌ No | 🔴 **REQUIRED** | 🔴 **NEEDS FIX** |
| **F. CSV Import** | `src/components/workpackages/CSVImportWizard.jsx` | N/A | ❌ Not implemented | ❌ N/A | 🔴 **REQUIRED** | 🔴 **NOT IMPLEMENTED** |
| **G. Microsoft Import** | `src/app/(authenticated)/contacts/enrich/microsoft/page.jsx` | N/A | ❌ Not implemented | ❌ N/A | 🔴 **REQUIRED** | 🔴 **NOT IMPLEMENTED** |

---

## Implementation Plan

### Step 1: Create Universal Pipeline Service

**File**: `src/lib/services/pipelineService.ts` (NEW)

```typescript
import { prisma } from '@/lib/prisma';
import { isValidPipeline, isValidStageForPipeline, getStagesForPipeline } from '@/lib/config/pipelineConfig';

/**
 * Ensure a contact has a pipeline record
 * Creates default pipeline (prospect/interest) if missing
 */
export async function ensureContactPipeline(
  contactId: string,
  pipeline?: string,
  stage?: string
): Promise<void> {
  const existing = await prisma.pipeline.findUnique({
    where: { contactId },
  });

  if (existing) {
    // Pipeline exists - update if new values provided
    if (pipeline || stage) {
      const finalPipeline = pipeline || existing.pipeline;
      const finalStage = stage || existing.stage;

      // Validate
      if (!isValidPipeline(finalPipeline)) {
        throw new Error(`Invalid pipeline: ${finalPipeline}`);
      }
      if (finalStage && !isValidStageForPipeline(finalStage, finalPipeline)) {
        throw new Error(`Invalid stage ${finalStage} for pipeline ${finalPipeline}`);
      }

      await prisma.pipeline.update({
        where: { contactId },
        data: {
          pipeline: finalPipeline,
          stage: finalStage || null,
        },
      });
    }
    return;
  }

  // Pipeline doesn't exist - create with defaults
  const defaultPipeline = pipeline || 'prospect';
  const defaultStage = stage || 'interest';

  // Validate
  if (!isValidPipeline(defaultPipeline)) {
    throw new Error(`Invalid pipeline: ${defaultPipeline}`);
  }
  if (defaultStage && !isValidStageForPipeline(defaultStage, defaultPipeline)) {
    throw new Error(`Invalid stage ${defaultStage} for pipeline ${defaultPipeline}`);
  }

  await prisma.pipeline.create({
    data: {
      contactId,
      pipeline: defaultPipeline,
      stage: defaultStage,
    },
  });
}
```

### Step 2: Apply to All Contact Save Paths

**A. Enrichment Save** (`src/app/api/contacts/enrich/save/route.ts`):
```typescript
// After contact update (line 300)
const updatedContact = await prisma.contact.update({...});

// Ensure pipeline exists
await ensureContactPipeline(updatedContact.id, 'prospect', 'interest');
```

**B. Manual Create** (`src/app/api/contacts/route.js`):
```javascript
// After contact create (lines 233, 266)
contact = await prisma.contact.create({
  data: {
    // ... contact data
    pipeline: {
      create: {
        pipeline: pipeline || 'prospect',
        stage: stage || 'interest',
      },
    },
  },
});
```

**C. Universal Create** (`src/app/api/contacts/universal-create/route.js`):
```javascript
// After contact create (lines 165, 196)
contact = await prisma.contact.create({
  data: {
    // ... contact data
    pipeline: {
      create: {
        pipeline: pipelineData?.pipeline || 'prospect',
        stage: pipelineData?.stage || 'interest',
      },
    },
  },
});
```

**D. Contact Update** (`src/app/api/contacts/[contactId]/route.js`):
```javascript
// After contact update (line 198)
const contact = await prisma.contact.update({...});

// Ensure pipeline exists
await ensureContactPipeline(contact.id, pipeline, stage);
```

**E. Contact Service** (`src/lib/services/contactService.ts`):
```typescript
// After contact upsert (line 127)
const contact = await prisma.contact.upsert({...});

// Ensure pipeline exists
await ensureContactPipeline(contact.id, 'prospect', 'interest');
```

### Step 3: Add Validation

**Add to all endpoints**:
```typescript
// Validate pipeline if provided
if (pipeline && !isValidPipeline(pipeline)) {
  return NextResponse.json(
    { success: false, error: `Invalid pipeline: ${pipeline}` },
    { status: 400 }
  );
}

if (stage && pipeline && !isValidStageForPipeline(stage, pipeline)) {
  return NextResponse.json(
    { success: false, error: `Invalid stage ${stage} for pipeline ${pipeline}` },
    { status: 400 }
  );
}
```

---

## Testing Checklist

After implementation, verify:

- [ ] Enrichment save creates pipeline (prospect/interest)
- [ ] Manual contact creation creates pipeline (prospect/interest)
- [ ] Universal create creates pipeline (prospect/interest)
- [ ] Contact update ensures pipeline exists
- [ ] Contact service upsert creates pipeline
- [ ] Invalid pipeline values are rejected
- [ ] Invalid stage values are rejected
- [ ] Pipeline conversion (prospect → client) still works
- [ ] Deal pipelines view shows all contacts
- [ ] Persona generation works with pipeline context

---

## Next Steps

1. ✅ **Investigation Complete** - All contact save paths identified
2. ⏳ **Create Pipeline Service** - Universal `ensureContactPipeline()` function
3. ⏳ **Apply to All Paths** - Update all 5 contact save endpoints
4. ⏳ **Add Validation** - Validate pipeline+stage on all endpoints
5. ⏳ **Test** - Verify all paths create pipeline correctly

---

**Last Updated**: January 2025  
**Status**: Investigation complete - Ready for implementation  
**Priority**: High - Required for prospect/client distinction

