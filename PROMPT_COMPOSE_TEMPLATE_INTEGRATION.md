# Prompt: Add Template Selection & Hydration to Compose Page

## Context

The `/outreach/compose` page currently sends emails directly without template variable hydration. We need to add template selection and variable hydration so users can:
1. Select an email template
2. See variables automatically filled with contact data
3. Send personalized emails

## Current State

### ✅ What Works:
- Contact selection (sets `contactId`)
- Manual email composition
- Email sending via `/api/outreach/send`

### ❌ What's Missing:
- Template selection UI
- Template hydration before sending
- Preview of hydrated content

## Task: Add Template Selection & Hydration

### Step 1: Update `/api/template/hydrate-with-contact` Route

**File:** `app/api/template/hydrate-with-contact/route.js`

**Current Issue:** Uses old `outreach_templates` model (line 32)

**Fix Required:**
- Change from `prisma.outreach_templates` to `prisma.template` (new model)
- Use `template.body` and `template.subject` instead of `template.content`
- Remove references to `template_bases` and `template_variables` (old schema)

**Expected Input:**
```json
{
  "templateId": "uuid",
  "contactId": "uuid",
  "metadata": {} // optional
}
```

**Expected Output:**
```json
{
  "success": true,
  "hydratedSubject": "Hi Sarah, ...",
  "hydratedBody": "Hey Sarah,\n\nYour email...",
  "originalTemplate": { "subject": "...", "body": "..." },
  "validation": { "valid": true, "missingVariables": [] },
  "contactData": { ... }
}
```

### Step 2: Add Template Selection UI to Compose Page

**File:** `app/(authenticated)/outreach/compose/page.jsx`

**Reference Pattern:** See `app/(authenticated)/outreach/campaigns/[campaignId]/edit/page.jsx` lines 332-411 for template selection UI pattern.

**Required Changes:**

1. **Add State:**
   ```javascript
   const [emailMode, setEmailMode] = useState('manual'); // 'manual' | 'template'
   const [selectedTemplateId, setSelectedTemplateId] = useState(null);
   const [templates, setTemplates] = useState([]);
   const [loadingTemplates, setLoadingTemplates] = useState(false);
   const [hydratedSubject, setHydratedSubject] = useState('');
   const [hydratedBody, setHydratedBody] = useState('');
   ```

2. **Load Templates:**
   - Fetch templates by `ownerId` from `/api/templates?ownerId=${ownerId}`
   - Load on mount when `ownerId` is available

3. **Add Mode Toggle:**
   - Toggle between "Manual" and "Use Template" modes
   - Similar to campaigns page (lines 333-359)

4. **Template Selector:**
   - Dropdown/list to select template
   - Show template title, subject preview
   - When selected, load template subject/body

5. **Hydration Logic:**
   - When template is selected AND contact is selected:
     - Call `/api/template/hydrate-with-contact` with `templateId` and `contactId`
     - Update `hydratedSubject` and `hydratedBody`
     - Show hydrated content in subject/body fields
   - Re-hydrate when contact changes (if template is selected)
   - Re-hydrate when template changes (if contact is selected)

### Step 3: Update Send Flow

**In `handleSend` function:**

1. **If using template mode:**
   - Ensure template is hydrated before sending
   - Use `hydratedSubject` and `hydratedBody` instead of manual input
   - Validate that both template and contact are selected

2. **Send hydrated content:**
   ```javascript
   const response = await api.post('/api/outreach/send', {
     to,
     toName,
     subject: emailMode === 'template' ? hydratedSubject : subject,
     body: emailMode === 'template' ? hydratedBody : body,
     contactId,
     tenantId,
   });
   ```

## Technical Details

### Variable Mapping (Already Works)

The `hydrateTemplate()` function in `lib/templateVariables.js` already handles:
- `{{firstName}}` → `contact.firstName || contact.goesBy || 'there'`
- `{{lastName}}` → `contact.lastName`
- `{{fullName}}` → `contact.fullName || firstName + lastName`
- `{{companyName}}` → `contact.companyName || 'your company'`
- `{{title}}` → `contact.title || 'your role'`

### Contact Data Fields Available:
```javascript
{
  firstName, lastName, fullName, goesBy,
  email, title, companyName, companyDomain,
  updatedAt, createdAt
}
```

### Template Model Schema:
```prisma
model Template {
  id          String
  ownerId     String
  title       String
  subject     String  // Email subject with {{variables}}
  body        String  // Email body with {{variables}}
  createdAt   DateTime
}
```

## Files to Modify

1. **`app/api/template/hydrate-with-contact/route.js`**
   - Update to use `Template` model
   - Return `hydratedSubject` and `hydratedBody` separately

2. **`app/(authenticated)/outreach/compose/page.jsx`**
   - Add template selection UI
   - Add hydration logic
   - Update send flow

## Testing Checklist

- [ ] Can select template from dropdown
- [ ] Template subject/body loads when selected
- [ ] Variables are replaced with contact data
- [ ] Hydrated content shows in preview
- [ ] Email sends with hydrated content
- [ ] Manual mode still works (no regression)
- [ ] Switching between modes works smoothly
- [ ] Re-hydration happens when contact changes
- [ ] Validation works (requires both template and contact in template mode)

## Reference Code

**Template Selection Pattern:**
See `app/(authenticated)/outreach/campaigns/[campaignId]/edit/page.jsx:332-411`

**Hydrate Function:**
See `lib/templateVariables.js:139-170`

**Current Compose Send:**
See `app/(authenticated)/outreach/compose/page.jsx:107-181`

## Notes

- The variable mapper service already exists and works correctly
- Just need to integrate it into the compose flow
- Make sure to handle loading states and errors gracefully
- Consider showing a "preview" mode to see hydrated content before sending

