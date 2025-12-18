# Template System - How It Actually Works

## The Key Insight

There are **TWO types of data** in a template:

1. **Template Context** (defined during template creation)
   - Time since connected: "a long time"
   - Time horizon: "2026"
   - My business description: "my own NDA house"
   - Desired outcome: "see if we can collaborate and get some NDA work"
   - These are **baked into the template content** as plain text

2. **Contact Variables** (filled when sending to a specific person)
   - First name: `{{firstName}}`
   - Company name: `{{companyName}}`
   - These are **variable tags** that get replaced with contact data

## Your Example Workflow

### Step 1: Create Template (Build Page)

**You fill out the form:**

**Basic Context:**
- Relationship: `DORMANT`
- Type of Person: `FORMER_COWORKER`
- Why Reaching Out: "Haven't connected in a while"

**Template Context Fields (NEW!):**
- Time Since Connected: `a long time`
- Time Horizon: `2026`
- My Business Description: `my own NDA house`
- Desired Outcome: `see if we can collaborate and get some NDA work`
- Knowledge of Business: `No` (unchecked)

### Step 2: AI Generates Template

The AI creates this template with the context **baked in** as text, and only contact info as variables:

```
Hi {{firstName}},

I know it's been a long time since we connected. I saw you recently started working at {{companyName}}.

Not sure if you knew, but I run my own NDA house.

Let's get together in 2026 — see if we can collaborate and get some NDA work from you.

No pressure at all — just wanted to reach out.

Cheers to what's ahead!

Joel
```

**Notice:**
- `{{firstName}}` and `{{companyName}}` are **variables** (will be filled later)
- "a long time", "2026", "my own NDA house", "see if we can collaborate..." are **plain text** (already filled in)

### Step 3: Send to Contact

When you want to email Sarah Johnson at TechCorp:

```javascript
const contact = {
  firstName: 'Sarah',
  companyName: 'TechCorp'
};

const email = hydrateTemplate(template.content, contact);
```

**Result:**
```
Hi Sarah,

I know it's been a long time since we connected. I saw you recently started working at TechCorp.

Not sure if you knew, but I run my own NDA house.

Let's get together in 2026 — see if we can collaborate and get some NDA work from you.

No pressure at all — just wanted to reach out.

Cheers to what's ahead!

Joel
```

## Why This Design?

### Template Context = Your Intent
When you create a template, you're defining:
- **How long** it's been ("a long time" vs "2 years")
- **When** you want to connect ("2026" vs "soon")
- **What** your business is ("my own NDA house")
- **Why** you're reaching out ("get some NDA work")

These are **strategic decisions** you make once per template type.

### Contact Variables = Personalization
The contact-specific info changes for each person:
- Their **first name**
- Their **company name**
- Their **job title**

These get filled in **automatically** from your contact database.

## Database Schema

### `template_bases` Table
Stores your template context (what you input during creation):

```sql
CREATE TABLE template_bases (
  id UUID PRIMARY KEY,
  title TEXT,
  relationship ENUM,
  typeOfPerson ENUM,
  whyReachingOut TEXT,
  whatWantFromThem TEXT,
  -- Template Context Fields (NEW)
  timeSinceConnected TEXT,        -- "a long time", "2 years"
  timeHorizon TEXT,               -- "2026", "Q1 2025"
  myBusinessDescription TEXT,     -- "my own NDA house"
  desiredOutcome TEXT,            -- "collaborate on NDA work"
  knowledgeOfBusiness BOOLEAN     -- Do they know about your business?
);
```

### `outreach_templates` Table
Stores the generated template content:

```sql
CREATE TABLE outreach_templates (
  id UUID PRIMARY KEY,
  templateBaseId UUID REFERENCES template_bases(id),
  content TEXT,  -- The template with {{variables}} for contact data
  mode TEXT      -- 'MANUAL' or 'AI'
);
```

## The Form in the UI

### Basic Fields (Always shown)
- Relationship
- Type of Person
- Why Reaching Out
- What Want From Them

### Template Context Fields (Only in "Variables" mode)
- **Time Since Connected** - Input: "a long time"
- **Time Horizon** - Input: "2026"
- **My Business Description** - Input: "my own NDA house"
- **Desired Outcome** - Input: "see if we can collaborate and get some NDA work"
- **Knowledge of Business** - Checkbox: Yes/No

## Example: Multiple Contacts, Same Template

You create ONE template with context:
```
Hi {{firstName}},

I know it's been a long time since we connected. I saw you recently started working at {{companyName}}.

Not sure if you knew, but I run my own NDA house.

Let's get together in 2026 — see if we can collaborate and get some NDA work from you.

Cheers to what's ahead!

Joel
```

Then send it to multiple people:

**To Sarah at TechCorp:**
```
Hi Sarah,

I know it's been a long time since we connected. I saw you recently started working at TechCorp.

Not sure if you knew, but I run my own NDA house.

Let's get together in 2026 — see if we can collaborate and get some NDA work from you.

Cheers to what's ahead!

Joel
```

**To Mike at StartupXYZ:**
```
Hi Mike,

I know it's been a long time since we connected. I saw you recently started working at StartupXYZ.

Not sure if you knew, but I run my own NDA house.

Let's get together in 2026 — see if we can collaborate and get some NDA work from you.

Cheers to what's ahead!

Joel
```

Same context, different contact info!

## Migration Steps

### 1. Update Database
```bash
cd /Users/adamcole/Documents/Ignite/IgniteBd-Next-combine
npx prisma migrate dev --name add_template_context_fields
```

### 2. Test in UI
1. Go to `/template/build`
2. Click **"Variables"** mode
3. Fill in:
   - Relationship: Dormant
   - Type of Person: Former Coworker
   - Why Reaching Out: "Haven't connected in a while"
   - **Time Since Connected:** "a long time"
   - **Time Horizon:** "2026"
   - **My Business:** "my own NDA house"
   - **Desired Outcome:** "see if we can collaborate and get some NDA work"
4. Click "Generate Template"
5. See the template with `{{firstName}}` and `{{companyName}}` as the only variables!

### 3. Use the Template
```javascript
// When sending to a contact
import { hydrateTemplate } from '@/lib/templateVariables';

const contact = await prisma.contact.findUnique({
  where: { id: contactId },
  select: { firstName: true, companyName: true }
});

const template = await prisma.outreach_templates.findUnique({
  where: { id: templateId }
});

const email = hydrateTemplate(template.content, contact, {});
// Only firstName and companyName get replaced!
```

## Summary

**Template Context (Form Input → Baked into template):**
- Time since connected
- Time horizon
- Business description
- Desired outcome
- Knowledge check

**Contact Variables (Database → Filled at send time):**
- {{firstName}}
- {{companyName}}
- {{title}}

This way you define the **strategy** once (template context), then **personalize** it many times (contact variables).
