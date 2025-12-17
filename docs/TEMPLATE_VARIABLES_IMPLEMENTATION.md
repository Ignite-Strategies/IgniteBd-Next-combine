# Template Variables Implementation Summary

## What Was Built

A complete **dynamic template system** with variable tags for personalized outreach emails.

### Problem Solved
Instead of generic static emails like "Hey bro", you can now create templates with variables like `{{firstName}}`, `{{companyName}}`, `{{timeSinceConnected}}` that get filled in with actual contact data.

## Files Created/Modified

### 1. Schema Updates
**File:** `prisma/schema.prisma`

Added:
- `template_variables` table - Tracks variables used in each template
- `TemplateVariableType` enum - Types: TEXT, DATE, TIME_DURATION, BOOLEAN, ENUM, CUSTOM
- Relationship between `outreach_templates` and `template_variables`

### 2. Utility Library
**File:** `lib/templateVariables.js`

Functions:
- `extractVariables(content)` - Parse variable tags from template
- `calculateTimeSince(date)` - Calculate duration (e.g., "2 years")
- `hydrateTemplate(template, contactData, metadata)` - Fill in variables with data
- `validateHydration(content)` - Check for missing variables
- `generateTemplateWithVariables(templateBase)` - Create template with tags
- `getDefaultVariableValues()` - Default preview values

### 3. API Endpoints

**File:** `app/api/template/generate-with-variables/route.js`
- AI-powered template generation with variable tags
- Extracts and returns detected variables

**File:** `app/api/template/hydrate-with-contact/route.js`
- Hydrates template with contact data
- Validates all variables are filled

### 4. UI Components

**File:** `app/(authenticated)/template/build/page.jsx` (modified)
- Added "Variables" mode to template builder
- Shows detected variables in preview
- Monospace font for variable tags

**File:** `components/TemplateHydrationDemo.jsx`
- Interactive demo for testing template hydration
- Shows how to fill in contact data and metadata
- Real-time preview of hydrated output

### 5. Documentation

**File:** `docs/TEMPLATE_VARIABLES_GUIDE.md`
- Complete guide to the system
- API documentation
- Usage examples
- Best practices

**File:** `docs/TEMPLATE_VARIABLES_IMPLEMENTATION.md`
- This file - implementation summary

## How It Works

### Step 1: Create Template with Variables

```
Hi {{firstName}},

I know it's been {{timeSinceConnected}} since we connected. 
I saw you recently started working at {{companyName}}.

Not sure if you knew, but I run {{myBusinessName}}.

Let's get together in {{timeHorizon}} — {{desiredOutcome}}.

No pressure at all — just wanted to reach out.

Cheers to what's ahead!

{{myRole}}
```

### Step 2: Hydrate with Contact Data

```javascript
const contactData = {
  firstName: 'Sarah',
  companyName: 'TechCorp',
  lastContactDate: '2022-06-15',
};

const metadata = {
  myBusinessName: 'My NDA House',
  myRole: 'Joel',
  timeHorizon: '2026',
  desiredOutcome: 'see if we can collaborate and get some NDA work',
};

const email = hydrateTemplate(template, contactData, metadata);
```

### Step 3: Send Personalized Email

```
Hi Sarah,

I know it's been 2 years since we connected. 
I saw you recently started working at TechCorp.

Not sure if you knew, but I run My NDA House.

Let's get together in 2026 — see if we can collaborate and get some NDA work.

No pressure at all — just wanted to reach out.

Cheers to what's ahead!

Joel
```

## Available Variables

| Variable | Source | Example |
|----------|--------|---------|
| `{{firstName}}` | Contact.firstName | "Sarah" |
| `{{lastName}}` | Contact.lastName | "Johnson" |
| `{{companyName}}` | Contact.companyName | "TechCorp" |
| `{{title}}` | Contact.title | "VP of Engineering" |
| `{{timeSinceConnected}}` | Calculated from lastContactDate | "2 years" |
| `{{timeHorizon}}` | Metadata | "2026" |
| `{{desiredOutcome}}` | Metadata | "collaborate on NDA work" |
| `{{myBusinessName}}` | Metadata | "Ignite Growth Partners" |
| `{{myRole}}` | Metadata | "Joel" |
| `{{knowledgeOfBusiness}}` | Metadata (boolean) | "yes"/"no" |

## Next Steps

### 1. Run Database Migration

```bash
cd /Users/adamcole/Documents/Ignite/IgniteBd-Next-combine
npx prisma migrate dev --name add_template_variables
```

This will:
- Create `template_variables` table
- Add `TemplateVariableType` enum
- Update `outreach_templates` table

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Test in UI

1. Go to `/template/build`
2. Click the **"Variables"** button (new mode)
3. Fill in the form fields
4. Click "Generate Template"
5. See the template with `{{variableName}}` tags
6. Review detected variables

### 4. Test Hydration

```javascript
// In your email sending code
import { hydrateTemplate } from '@/lib/templateVariables';

const contact = await prisma.contact.findUnique({
  where: { id: contactId }
});

const metadata = {
  myBusinessName: 'Your Business Name',
  myRole: 'Your Name',
  timeHorizon: '2026',
  desiredOutcome: 'what you want',
};

const emailContent = hydrateTemplate(
  template.content,
  contact,
  metadata
);

// Send emailContent via your email provider
```

## Example: Your Use Case

**Your Template:**
```
Hi {{firstName}},

I know it's been {{timeSinceConnected}} since we connected. I saw you recently started working at {{companyName}}.

Not sure if you knew, but I run my own NDA house.

Let's get together in {{timeHorizon}} — see if we can collaborate and get some NDA work from you.

No pressure at all — just wanted to reach out.

Cheers to what's ahead!

Joel
```

**For Contact: Sarah Johnson at TechCorp (last contacted 2 years ago)**

**Hydrated Output:**
```
Hi Sarah,

I know it's been 2 years since we connected. I saw you recently started working at TechCorp.

Not sure if you knew, but I run my own NDA house.

Let's get together in 2026 — see if we can collaborate and get some NDA work from you.

No pressure at all — just wanted to reach out.

Cheers to what's ahead!

Joel
```

## Integration Points

### Where to Use This

1. **Email Composer** - When composing emails to contacts
2. **Bulk Outreach** - Send personalized emails to multiple contacts
3. **Automated Sequences** - Use in email drip campaigns
4. **Contact Detail Page** - Quick "Send Template" action

### Code Example

```jsx
// In your contact detail page or email composer
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { hydrateTemplate } from '@/lib/templateVariables';

function EmailComposer({ contact, template }) {
  const [emailContent, setEmailContent] = useState('');
  
  useEffect(() => {
    // Hydrate template when component mounts
    const metadata = {
      myBusinessName: 'Ignite Growth Partners',
      myRole: 'Joel',
      timeHorizon: '2026',
      desiredOutcome: 'see if we can collaborate',
    };
    
    const hydrated = hydrateTemplate(
      template.content,
      contact,
      metadata
    );
    
    setEmailContent(hydrated);
  }, [contact, template]);
  
  return (
    <div>
      <h3>Email to {contact.firstName}</h3>
      <textarea 
        value={emailContent}
        onChange={(e) => setEmailContent(e.target.value)}
        rows={15}
      />
      <button onClick={sendEmail}>Send Email</button>
    </div>
  );
}
```

## Testing

### Manual Testing

1. Create a template with variables in UI
2. Use the demo component to test hydration
3. Verify all variables are replaced correctly
4. Check edge cases (missing data, etc.)

### Automated Testing

```javascript
import { hydrateTemplate, calculateTimeSince } from '@/lib/templateVariables';

// Test hydration
const template = 'Hi {{firstName}}, from {{myBusinessName}}';
const result = hydrateTemplate(template, 
  { firstName: 'Sarah' },
  { myBusinessName: 'My Company' }
);
console.assert(result === 'Hi Sarah, from My Company');

// Test time calculation
const twoYearsAgo = new Date();
twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
const duration = calculateTimeSince(twoYearsAgo);
console.assert(duration === '2 years');
```

## Rollout Plan

### Phase 1: Infrastructure (✅ COMPLETE)
- ✅ Schema updates
- ✅ Utility functions
- ✅ API endpoints
- ✅ UI components

### Phase 2: Migration (NEXT)
- Run Prisma migrations
- Test with existing templates
- Create first variable templates

### Phase 3: Integration
- Add to email composer
- Add to bulk outreach
- Add quick-send actions

### Phase 4: Optimization
- Cache frequently used contact data
- Add more variable types
- Template library with variables

## Support & Troubleshooting

### Common Issues

**Variables not replacing:**
- Check variable names are exact (case-sensitive)
- Ensure using `{{variableName}}` format (double braces)
- Verify contact data is passed correctly

**Missing data:**
- System uses fallbacks for missing data
- Configure default values in template_variables table
- Check contact record has required fields

**Time calculations wrong:**
- Verify lastContactDate is valid date
- Check timezone settings
- Use Contact.updatedAt as fallback

### Getting Help

1. Check `docs/TEMPLATE_VARIABLES_GUIDE.md` for detailed guide
2. Review `lib/templateVariables.js` for function documentation
3. Test with `TemplateHydrationDemo` component
4. Check API responses for error messages

## Future Enhancements

Potential additions:
- Conditional sections (if/else logic)
- Date formatting options
- Custom variable types
- Template versioning
- A/B testing
- Template analytics
- Suggested variables based on context
- Multi-language support
