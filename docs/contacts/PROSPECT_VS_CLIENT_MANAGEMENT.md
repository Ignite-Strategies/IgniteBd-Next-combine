# Prospect vs Client Management - Complete Guide

## Overview

**Key Principle**: A **Contact** is a person (universal entity). The distinction between **Prospect** and **Client** is determined by the **Pipeline** model, not the Contact model itself.

**Architecture**: Contact-First with Pipeline State
- **Contact**: Universal person entity (all people)
- **Pipeline**: Separate model that tracks pipeline type and stage
- **One-to-One**: Each Contact can have one Pipeline record

---

## Pipeline Model

**Location**: `prisma/schema.prisma`

```prisma
model Pipeline {
  id        String   @id @default(cuid())
  contactId String   @unique  // One Pipeline per Contact
  pipeline  String             // Pipeline type: "prospect" | "client" | "collaborator" | "institution"
  stage     String             // Stage within pipeline
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  contact   Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@map("pipelines")
}
```

### Pipeline Types

1. **`prospect`** - People you're trying to convert into clients
2. **`client`** - People who have become customers
3. **`collaborator`** - Strategic partners/collaborators
4. **`institution`** - Institutional relationships

### Pipeline Stages

**Prospect Pipeline**:
- `need-to-engage` - Contact in CRM but hasn't been emailed yet
- `interest` - Initial interest expressed
- `meeting` - Meeting scheduled/held
- `proposal` - Proposal sent
- `contract` - Contract in progress
- `contract-signed` - Contract signed → **AUTO-CONVERTS TO CLIENT**

**Client Pipeline**:
- `kickoff` - Project kickoff
- `work-started` - Work has started
- `work-delivered` - Work delivered
- `sustainment` - Sustainment phase
- `renewal` - Renewal (upsell - starting new work)
- `terminated-contract` - Contract terminated

**Collaborator Pipeline**:
- `interest` - Initial interest
- `meeting` - Meeting scheduled/held
- `moa` - Memorandum of Agreement
- `agreement` - Formal agreement

**Institution Pipeline**:
- `interest` - Initial interest
- `meeting` - Meeting scheduled/held
- `moa` - Memorandum of Agreement
- `agreement` - Formal agreement

---

## Prospect vs Client Distinction

### How It Works

**A Contact is a Prospect when**:
- `Pipeline.pipeline === "prospect"` (or no Pipeline exists)
- Default state for new contacts

**A Contact is a Client when**:
- `Pipeline.pipeline === "client"`
- Automatically converted when prospect reaches `contract-signed` stage

### Conversion Trigger

**Automatic Conversion**: `prospect` + `contract-signed` → `client` + `kickoff`

**Location**: `src/lib/services/PipelineTriggerService.js`

**Process**:
1. User updates contact pipeline to `prospect` + `contract-signed`
2. `PipelineTriggerService.checkPipelineTriggers()` detects the trigger
3. Automatically converts to `client` + `kickoff`
4. Returns converted contact

**Code**:
```javascript
// Trigger: contract-signed in prospect pipeline → convert to client with kickoff
if (newPipeline === 'prospect' && newStage === 'contract-signed') {
  return await convertProspectToClient(contactId);
}
```

---

## Contact Model Relationship

**Contact → Pipeline**: One-to-One (optional)

```prisma
model Contact {
  // ... all contact fields
  pipeline Pipeline?  // Optional - contact may not be in pipeline
}
```

**Access Pattern**:
```javascript
// Check if contact is a prospect
const isProspect = contact.pipeline?.pipeline === 'prospect';

// Check if contact is a client
const isClient = contact.pipeline?.pipeline === 'client';

// Get current stage
const currentStage = contact.pipeline?.stage; // e.g., "interest", "kickoff"
```

---

## Enrichment Process & Pipeline Handling

### Current State

**Problem**: Enrichment process doesn't handle pipeline creation/assignment.

**Current Flow**:
1. User enriches contact (Apollo)
2. Contact saved with enrichment data
3. **Pipeline is NOT created** (contact has no pipeline)
4. Contact appears as "Unassigned" in deal pipelines view

### Recommended Enrichment Flow

**Option 1: Default to Prospect** (Recommended)
```
1. User enriches contact
2. Contact saved
3. If no Pipeline exists → Create Pipeline with:
   - pipeline: "prospect"
   - stage: "interest"
```

**Option 2: User Selection**
```
1. User enriches contact
2. Enrichment success modal shows:
   - "Save as Prospect" (default)
   - "Save as Client" (if already a client)
   - "Skip Pipeline" (don't create pipeline)
3. Create Pipeline based on user selection
```

**Option 3: Smart Detection**
```
1. User enriches contact
2. Check if contact already has proposals/contracts
3. If has active contract → Create Pipeline as "client" + "work-started"
4. If has proposals → Create Pipeline as "prospect" + "proposal"
5. Otherwise → Create Pipeline as "prospect" + "interest"
```

---

## Implementation Guide

### 1. Update Enrichment Save Endpoint

**Location**: `src/app/api/contacts/enrich/save/route.ts`

**Add Pipeline Creation**:
```typescript
// After saving contact
if (!contact.pipeline) {
  // Create default pipeline (prospect/interest)
  await prisma.pipeline.create({
    data: {
      contactId: contact.id,
      pipeline: 'prospect',
      stage: 'interest',
    },
  });
}
```

### 2. Update Enrichment Success Modal

**Location**: `src/app/(authenticated)/contacts/enrich/linkedin/page.jsx`

**Add Pipeline Selection**:
```javascript
// In success modal, add option:
<button onClick={() => {
  // Save as prospect (default)
  handleSaveWithPipeline('prospect', 'interest');
}}>
  Save as Prospect
</button>

<button onClick={() => {
  // Save as client (if already converted)
  handleSaveWithPipeline('client', 'kickoff');
}}>
  Save as Client
</button>
```

### 3. Update Persona Generation Service

**Location**: `src/lib/services/EnrichmentToPersonaService.ts`

**Check Pipeline Before Generating**:
```typescript
// When generating persona from contactId
const contact = await prisma.contact.findUnique({
  where: { id: contactId },
  include: {
    pipeline: true,  // Include pipeline
    company: true,
  },
});

// Use pipeline context in persona generation
const pipelineContext = contact.pipeline 
  ? `${contact.pipeline.pipeline} in ${contact.pipeline.stage} stage`
  : 'new prospect';
```

---

## API Endpoints

### Get Contact with Pipeline

**Endpoint**: `GET /api/contacts/[contactId]`

**Response**:
```json
{
  "success": true,
  "contact": {
    "id": "contact_123",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "pipeline": {
      "id": "pipeline_123",
      "contactId": "contact_123",
      "pipeline": "prospect",
      "stage": "interest"
    }
  }
}
```

### Update Pipeline

**Endpoint**: `PUT /api/contacts/[contactId]`

**Body**:
```json
{
  "pipeline": "prospect",
  "stage": "contract-signed"
}
```

**Response**: If `contract-signed` in `prospect` pipeline, automatically converts:
```json
{
  "success": true,
  "contact": {
    "id": "contact_123",
    "pipeline": {
      "pipeline": "client",
      "stage": "kickoff"
    },
    "converted": true
  }
}
```

---

## Pipeline Configuration

**Location**: `src/lib/config/pipelineConfig.js`

**Usage**:
```javascript
import { 
  OFFICIAL_PIPELINES, 
  PIPELINE_STAGES, 
  getStagesForPipeline,
  isValidPipeline,
  isValidStageForPipeline 
} from '@/lib/config/pipelineConfig';

// Get stages for prospect pipeline
const prospectStages = getStagesForPipeline('prospect');
// Returns: ['interest', 'meeting', 'proposal', 'contract', 'contract-signed']

// Validate pipeline type
if (isValidPipeline('prospect')) {
  // Valid pipeline
}

// Validate stage for pipeline
if (isValidStageForPipeline('contract-signed', 'prospect')) {
  // Valid stage for prospect pipeline
}
```

---

## UI Display Patterns

### Deal Pipelines View

**Location**: `src/app/(authenticated)/contacts/deal-pipelines/page.jsx`

**Filtering**:
```javascript
// Filter contacts by pipeline
const prospects = contacts.filter(c => c.pipeline?.pipeline === 'prospect');
const clients = contacts.filter(c => c.pipeline?.pipeline === 'client');

// Filter by stage
const interestProspects = contacts.filter(
  c => c.pipeline?.pipeline === 'prospect' && c.pipeline?.stage === 'interest'
);
```

### Contact Detail Page

**Location**: `src/app/(authenticated)/contacts/[contactId]/page.jsx`

**Display**:
```javascript
// Show pipeline badge
{contact.pipeline ? (
  <span className="badge">
    {contact.pipeline.pipeline} - {contact.pipeline.stage}
  </span>
) : (
  <span className="badge">Unassigned</span>
)}
```

---

## Data Flow Examples

### New Contact Enrichment Flow

```
1. User enriches contact (Apollo)
   ↓
2. Contact saved to database
   ↓
3. Check if Pipeline exists
   ↓
4. If no Pipeline → Create Pipeline:
   - pipeline: "prospect"
   - stage: "interest"
   ↓
5. Return contact with pipeline
```

### Prospect to Client Conversion

```
1. User updates contact pipeline:
   - pipeline: "prospect"
   - stage: "contract-signed"
   ↓
2. PipelineTriggerService detects trigger
   ↓
3. Automatically converts:
   - pipeline: "client"
   - stage: "kickoff"
   ↓
4. Returns converted contact
```

### Persona Generation from Enriched Contact

```
1. User clicks "Start Persona Flow" after enrichment
   ↓
2. Persona builder calls:
   POST /api/personas/generate-from-enrichment
   {
     "contactId": "contact_123",
     "companyHQId": "hq_123",
     "mode": "save"
   }
   ↓
3. Service fetches contact with pipeline:
   - contact.pipeline.pipeline = "prospect"
   - contact.pipeline.stage = "interest"
   ↓
4. Uses pipeline context in persona generation:
   - "This is a prospect in interest stage"
   - Generates persona accordingly
   ↓
5. Persona created and linked to contact
```

---

## Best Practices

### 1. Always Check Pipeline

```javascript
// ✅ Good: Check pipeline before using
if (contact.pipeline?.pipeline === 'client') {
  // Show client-specific UI
}

// ❌ Bad: Assume pipeline exists
if (contact.pipeline.pipeline === 'client') {
  // Crashes if pipeline is null
}
```

### 2. Default to Prospect

```javascript
// ✅ Good: Default to prospect for new contacts
const pipeline = contact.pipeline?.pipeline || 'prospect';
const stage = contact.pipeline?.stage || 'interest';
```

### 3. Use Pipeline Config

```javascript
// ✅ Good: Use config for validation
import { isValidPipeline, getStagesForPipeline } from '@/lib/config/pipelineConfig';

if (isValidPipeline(newPipeline)) {
  const stages = getStagesForPipeline(newPipeline);
  if (stages.includes(newStage)) {
    // Valid pipeline and stage
  }
}
```

### 4. Handle Conversion

```javascript
// ✅ Good: Check for conversion after pipeline update
const result = await applyPipelineTriggers(contactId, pipeline, stage);
if (result?.converted) {
  // Contact was converted (prospect → client)
  console.log('Contact converted to client!');
}
```

---

## Refactoring Enrichment Process

### Current Issues

1. **No Pipeline Creation**: Enrichment doesn't create pipeline
2. **Unassigned Contacts**: Contacts appear as "Unassigned" in pipelines view
3. **No Context**: Persona generation doesn't know if contact is prospect/client

### Recommended Changes

#### 1. Update Save Endpoint

**File**: `src/app/api/contacts/enrich/save/route.ts`

**Add**:
```typescript
// After contact is created/updated
if (!contact.pipeline) {
  // Create default pipeline (prospect/interest)
  await prisma.pipeline.upsert({
    where: { contactId: contact.id },
    create: {
      contactId: contact.id,
      pipeline: 'prospect',
      stage: 'interest',
    },
    update: {
      // Pipeline already exists, don't update
    },
  });
  
  // Re-fetch contact with pipeline
  contact = await prisma.contact.findUnique({
    where: { id: contact.id },
    include: {
      pipeline: true,
      company: true,
      contactCompany: true,
    },
  });
}
```

#### 2. Update Success Modal

**File**: `src/app/(authenticated)/contacts/enrich/linkedin/page.jsx`

**Add Pipeline Info**:
```javascript
// In success modal, show pipeline info
{contact.pipeline && (
  <div className="pipeline-badge">
    {contact.pipeline.pipeline} - {contact.pipeline.stage}
  </div>
)}
```

#### 3. Update Persona Service

**File**: `src/lib/services/EnrichmentToPersonaService.ts`

**Include Pipeline Context**:
```typescript
// Fetch contact with pipeline
const contact = await prisma.contact.findUnique({
  where: { id: contactId },
  include: {
    pipeline: true,  // Include pipeline
    company: true,
    contactCompany: true,
  },
});

// Add pipeline context to prompt
const pipelineContext = contact.pipeline
  ? `This contact is a ${contact.pipeline.pipeline} in the ${contact.pipeline.stage} stage.`
  : 'This is a new contact (not yet assigned to a pipeline).';
```

---

## Summary

### Key Points

1. **Contact is Universal**: Contact model represents all people (prospects, clients, partners)
2. **Pipeline Determines Type**: `Pipeline.pipeline` field determines if contact is prospect/client
3. **One-to-One**: Each Contact can have one Pipeline record
4. **Auto-Conversion**: `prospect` + `contract-signed` → `client` + `kickoff`
5. **Default State**: New contacts should default to `prospect` + `interest`

### Current Gaps

1. ❌ Enrichment doesn't create pipeline
2. ❌ Contacts appear as "Unassigned" after enrichment
3. ❌ Persona generation doesn't use pipeline context

### Recommended Fixes

1. ✅ Create default pipeline (prospect/interest) during enrichment save
2. ✅ Show pipeline info in enrichment success modal
3. ✅ Include pipeline context in persona generation
4. ✅ Allow user to specify pipeline during enrichment (optional)

---

**Last Updated**: January 2025  
**Status**: Documentation complete - Implementation needed  
**Priority**: High - Affects enrichment UX and persona generation

