# Template Variables System Guide

## Overview

The template variables system allows you to create **dynamic email templates** with variable tags (like `{{firstName}}`, `{{companyName}}`) that get filled in with actual contact data when sending emails.

This solves the problem of having generic "Hey bro" emails by creating personalized, contextual outreach based on real contact information.

## How It Works

### 1. Template Creation with Variables

Instead of creating static text like:
```
Hi there,

I know it's been a long time since we connected...
```

You create a template with **variable tags**:
```
Hi {{firstName}},

I know it's been {{timeSinceConnected}} since we connected. I saw you recently started working at {{companyName}}.

Not sure if you knew, but I run {{myBusinessName}}.

Let's get together in {{timeHorizon}} — {{desiredOutcome}}.

No pressure at all — just wanted to reach out.

Cheers to what's ahead!

{{myRole}}
```

### 2. Variable Tag Format

Variables use the format `{{variableName}}` and are case-sensitive.

**Available Variables:**

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `{{firstName}}` | TEXT | Contact's first name | "Sarah" |
| `{{lastName}}` | TEXT | Contact's last name | "Johnson" |
| `{{companyName}}` | TEXT | Current company name | "TechCorp" |
| `{{title}}` | TEXT | Job title | "VP of Engineering" |
| `{{timeSinceConnected}}` | TIME_DURATION | Time since last contact | "2 years", "6 months" |
| `{{timeHorizon}}` | ENUM | When you want to connect | "2026", "Q1 2025" |
| `{{knowledgeOfBusiness}}` | BOOLEAN | Do they know your business? | "yes", "no" |
| `{{desiredOutcome}}` | TEXT | What you want from them | "see if we can collaborate" |
| `{{myBusinessName}}` | TEXT | Your company name | "Ignite Growth Partners" |
| `{{myRole}}` | TEXT | Your name/role | "Joel" |

### 3. Template Hydration

When you're ready to send an email, the system **hydrates** the template with actual data:

```javascript
// Contact data from database
const contactData = {
  firstName: 'Sarah',
  lastName: 'Johnson',
  companyName: 'TechCorp',
  title: 'VP of Engineering',
  lastContactDate: '2022-06-15',
};

// Your context/metadata
const metadata = {
  myBusinessName: 'Ignite Growth Partners',
  myRole: 'Joel',
  timeHorizon: '2026',
  desiredOutcome: 'see if we can collaborate and get some NDA work',
  knowledgeOfBusiness: false,
};

// Hydrate the template
const email = hydrateTemplate(templateContent, contactData, metadata);
```

**Output:**
```
Hi Sarah,

I know it's been 2 years since we connected. I saw you recently started working at TechCorp.

Not sure if you knew, but I run Ignite Growth Partners.

Let's get together in 2026 — see if we can collaborate and get some NDA work.

No pressure at all — just wanted to reach out.

Cheers to what's ahead!

Joel
```

## Database Schema

The system uses three main tables:

### `template_bases`
Stores the intent/context for templates:
- `relationship` (COLD, WARM, ESTABLISHED, DORMANT)
- `typeOfPerson` (CURRENT_CLIENT, FORMER_CLIENT, FORMER_COWORKER, etc.)
- `whyReachingOut`
- `whatWantFromThem`

### `outreach_templates`
Stores the actual template content with variable tags:
- `content` - The template with `{{variableName}}` tags
- `mode` - 'MANUAL' or 'AI'

### `template_variables`
Tracks which variables are used in each template:
- `variableName` (e.g., 'firstName', 'companyName')
- `variableType` (TEXT, DATE, TIME_DURATION, BOOLEAN, ENUM, CUSTOM)
- `defaultValue` - Fallback if data not available
- `description` - Help text

## API Endpoints

### Generate Template with Variables

**POST** `/api/template/generate-with-variables`

Creates an AI-generated template with variable tags.

**Request:**
```json
{
  "relationship": "DORMANT",
  "typeOfPerson": "FORMER_COWORKER",
  "whyReachingOut": "Haven't connected in a while and wanted to see how you're doing",
  "whatWantFromThem": "Would love to grab coffee"
}
```

**Response:**
```json
{
  "success": true,
  "template": "Hi {{firstName}},\n\nI know it's been {{timeSinceConnected}}...",
  "variables": [
    {
      "name": "firstName",
      "type": "TEXT",
      "description": "Contact's first name"
    },
    ...
  ]
}
```

### Hydrate Template with Contact Data

**POST** `/api/template/hydrate-with-contact`

Fills in template variables with actual contact data.

**Request:**
```json
{
  "templateId": "uuid",
  "contactId": "uuid",
  "metadata": {
    "myBusinessName": "Ignite Growth Partners",
    "timeHorizon": "2026",
    "desiredOutcome": "collaborate on NDA work"
  }
}
```

**Response:**
```json
{
  "success": true,
  "hydratedContent": "Hi Sarah,\n\nI know it's been 2 years...",
  "validation": {
    "valid": true,
    "missingVariables": []
  }
}
```

## Usage in UI

### Creating a Template (Build Page)

1. **Select "Variables" mode** in the template builder
2. Fill in the relationship context fields
3. Click "Generate Template" to create a template with variable tags
4. Review the detected variables
5. Save the template

### Using a Template (Sending Emails)

```jsx
import { hydrateTemplate } from '@/lib/templateVariables';

function EmailComposer({ contact, template }) {
  const metadata = {
    myBusinessName: 'My Company',
    myRole: 'Joel',
    timeHorizon: '2026',
    desiredOutcome: 'see if we can collaborate',
  };
  
  const emailContent = hydrateTemplate(
    template.content,
    contact,
    metadata
  );
  
  return <EmailEditor content={emailContent} />;
}
```

## Example: Your Use Case

Based on your request, here's the template:

**Template:**
```
Hi {{firstName}},

I know it's been {{timeSinceConnected}} since we connected. I saw you recently started working at {{companyName}}.

Not sure if you knew, but I run my own NDA house.

Let's get together in {{timeHorizon}} — see if we can collaborate and get some NDA work from you.

No pressure at all — just wanted to reach out.

Cheers to what's ahead!

Joel
```

**Contact Data Required:**
- `firstName` - From Contact.firstName or Contact.goesBy
- `timeSinceConnected` - Calculated from Contact.updatedAt or Contact.lastContactDate
- `companyName` - From Contact.companyName
- `timeHorizon` - Provided in metadata (e.g., "2026")

**Hydrated Result:**
```
Hi Sarah,

I know it's been 2 years since we connected. I saw you recently started working at TechCorp.

Not sure if you knew, but I run my own NDA house.

Let's get together in 2026 — see if we can collaborate and get some NDA work from you.

No pressure at all — just wanted to reach out.

Cheers to what's ahead!

Joel
```

## Advanced Features

### Time Since Connected Calculation

The `{{timeSinceConnected}}` variable is automatically calculated:

```javascript
import { calculateTimeSince } from '@/lib/templateVariables';

const duration = calculateTimeSince(contact.lastContactDate);
// Returns: "2 years", "6 months", "a few weeks", etc.
```

### Conditional Content

You can create templates with conditional logic:

```
Hi {{firstName}},

{{#if knowledgeOfBusiness}}
Great to reconnect! Hope {{myBusinessName}} is still on your radar.
{{else}}
Not sure if you knew, but I run {{myBusinessName}}.
{{/if}}
```

### Default Values

If a variable is missing, the system uses intelligent defaults:
- `{{firstName}}` → "there" (as in "Hi there,")
- `{{companyName}}` → "your company"
- `{{timeSinceConnected}}` → "a while"

## Best Practices

1. **Always include {{firstName}}** - Makes emails feel personal
2. **Use {{timeSinceConnected}}** for dormant relationships - Acknowledges the gap
3. **Reference {{companyName}}** when relevant - Shows you're paying attention
4. **Keep {{desiredOutcome}} soft** - Low pressure, optional feel
5. **Test with real data** - Use the hydration demo to preview

## Migration Guide

If you have existing static templates, you can convert them:

**Before (Static):**
```
Hi there,

I know it's been a long time since we connected...
```

**After (Dynamic):**
```
Hi {{firstName}},

I know it's been {{timeSinceConnected}} since we connected...
```

Use the "Variables" mode in the template builder to generate new templates with proper variable tags.

## Troubleshooting

### Variables not being replaced

Check that:
1. Variable names match exactly (case-sensitive)
2. Contact data is being passed to `hydrateTemplate()`
3. Variable tags use double curly braces `{{variableName}}`

### Missing data

If a contact is missing data (e.g., no `companyName`), the system will:
1. Use the default value if configured
2. Use a generic fallback (e.g., "your company")
3. Leave the variable tag if no fallback exists

### Time calculations wrong

Ensure `lastContactDate` or `updatedAt` is a valid date string or Date object.

## Next Steps

1. **Run migrations** to add new schema tables:
   ```bash
   npx prisma migrate dev --name add_template_variables
   ```

2. **Create your first variable template** in the UI using "Variables" mode

3. **Test hydration** with real contact data using the demo component

4. **Integrate with your email sending** workflow to use hydrated templates
