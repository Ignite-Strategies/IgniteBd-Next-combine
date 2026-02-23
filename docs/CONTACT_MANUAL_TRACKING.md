# Contact Manual Outreach Tracking

**Purpose:** Manual tracking fields for outreach relationship management and template selection.

---

## Added Fields

### 1. `persona_type` (PersonaType enum)
**Purpose:** Classify the contact's role in the buying process

**Options:**
- `DECISION_MAKER` - Has final say on purchases
- `INFLUENCER` - Influences decisions but doesn't decide
- `END_USER` - Will use the product/service
- `GATEKEEPER` - Controls access to decision makers
- `CHAMPION` - Internal advocate for your solution
- `OTHER` - Doesn't fit other categories

**Usage:** Set manually when you know their role. Helps select appropriate templates.

---

### 2. `prior_relationship` (RelationshipEnum)
**Purpose:** Track relationship warmth/type

**Options:**
- `COLD` - No prior relationship
- `WARM` - Met before, some familiarity
- `ESTABLISHED` - Strong existing relationship
- `DORMANT` - Had relationship, gone quiet

**Usage:** Set manually based on your history with them. Critical for template selection.

---

### 3. `lastContact` (String?)
**Purpose:** Manual note about when you last contacted them

**Usage:** 
- Simple string entry: "Aug 2025", "Last week", "2024-12-15", etc.
- No date parsing required - just a note
- Use for quick reference: "I reached out to him Aug 2025"

**Example:**
```typescript
contact.lastContact = "Aug 2025"
```

---

### 4. ~~`outreach_status`~~ (REMOVED - use Pipeline/Stage instead)
**Purpose:** ~~Track current state of outreach~~

**Why removed:** Duplicates existing Pipeline system!

**Use Pipeline/Stage instead:**
- Pipeline: `prospect`, `client`, `collaborator`, `institution`, `unassigned`
- Stages: `need-to-engage`, `interest`, `meeting`, `proposal`, `contract`, `contract-signed`, etc.

**Example:**
```typescript
// Instead of outreach_status = INITIAL_OUTREACH
contact.pipelines = {
  pipeline: 'prospect',
  stage: 'interest'  // or 'need-to-engage', 'meeting', etc.
}

// Instead of outreach_status = MEETING_SCHEDULED
contact.pipelines = {
  pipeline: 'prospect',
  stage: 'meeting'
}
```

**Pipeline stages already cover:**
- `need-to-engage` = NOT_CONTACTED
- `interest` = INITIAL_OUTREACH / ENGAGED
- `meeting` = MEETING_SCHEDULED
- `contract-signed` = CLOSED_WON
- `terminated-contract` = CLOSED_LOST

---

## Example Workflow

### Initial Contact Setup
```typescript
// User manually sets:
contact.persona_type = PersonaType.DECISION_MAKER
contact.prior_relationship = RelationshipEnum.COLD
contact.lastContact = null // Not contacted yet
// Pipeline: prospect / need-to-engage (or unassigned)
```

### First Outreach
```typescript
// User sends first email Aug 2025
contact.lastContact = "Aug 2025"
// Update pipeline stage: prospect / interest
contact.pipelines = {
  pipeline: 'prospect',
  stage: 'interest'
}
```

### Follow-up Needed
```typescript
// Query for follow-ups (has lastContact set, in prospect pipeline)
const followUps = await prisma.contact.findMany({
  where: {
    lastContact: { not: null }, // Has been contacted
    pipelines: {
      pipeline: 'prospect', // Not converted to client yet
      stage: { not: 'contract-signed' } // Not closed yet
    }
  },
  include: {
    pipelines: true
  }
})
```

### Template Selection Logic
```typescript
function selectTemplate(contact: Contact) {
  // Use manual fields for deterministic selection
  if (contact.prior_relationship === RelationshipEnum.COLD) {
    return 'cold-outreach-template'
  }
  if (contact.prior_relationship === RelationshipEnum.WARM) {
    return 'warm-followup-template'
  }
  if (contact.outreach_status === OutreachStatus.FOLLOW_UP) {
    return 'followup-template'
  }
  // ... etc
}
```

---

## Database Indexes

Added indexes for efficient querying:
- `@@index([prior_relationship])` - Filter by relationship type
- Pipeline/stage already indexed via `pipelines` model

---

## Migration

All fields are **optional** and **backward-compatible**:
- No existing data affected
- Can populate incrementally
- Defaults provided where appropriate

**To apply:**
```bash
npx prisma migrate dev --name add_manual_outreach_tracking
```

---

## Integration with Template System

These fields enable **deterministic template selection** without GPT:

1. **Relationship-based:** `prior_relationship` → cold/warm/established templates
2. **Pipeline-based:** `pipelines.pipeline` + `pipelines.stage` → prospect/client stage templates
3. **Persona-based:** `persona_type` → decision-maker vs influencer templates
4. **Recency-based:** `lastContact` → follow-up timing templates

**No GPT inference needed** - all selection logic can be rule-based using:
- Manual fields (`prior_relationship`, `persona_type`, `lastContact`)
- Existing Pipeline system (`pipelines.pipeline`, `pipelines.stage`)

**Example template selection:**
```typescript
function selectTemplate(contact) {
  // Use pipeline stage
  if (contact.pipelines?.stage === 'need-to-engage') {
    return 'cold-outreach-template'
  }
  if (contact.pipelines?.stage === 'interest') {
    return contact.prior_relationship === RelationshipEnum.COLD 
      ? 'cold-followup-template'
      : 'warm-followup-template'
  }
  // ... etc
}
```
