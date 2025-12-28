# Template Hydration Investigation - 1:1 Email Flow

## Current State

### 1. Compose Page (`/outreach/compose`)
- ✅ **Contact Selection**: User can select a contact (sets `contactId`)
- ❌ **Template Selection**: No template selection UI
- ❌ **Variable Hydration**: Currently sends emails directly without template hydration (line 132: "no template variable replacement")
- ✅ **Contact Data**: Gets contact info (email, name) when contact is selected

### 2. Template Hydration Service (`lib/templateVariables.js`)
- ✅ `hydrateTemplate(template, contactData, metadata)` - Replaces `{{variableName}}` with actual contact data
- ✅ Handles: firstName, lastName, fullName, companyName, title, email, timeSinceConnected
- ✅ Safe defaults if contact data is missing

### 3. API Endpoint (`/api/template/hydrate-with-contact`)
- ❌ **Uses Old Schema**: Still references `outreach_templates` (old model)
- ✅ **Hydration Logic**: Uses `hydrateTemplate()` function correctly
- ✅ **Contact Fetching**: Fetches contact by `contactId` from database

## How It Should Work

### Flow:
1. User selects contact → `contactId` is set
2. User selects template → `templateId` is set (NOT CURRENTLY IMPLEMENTED)
3. Before sending, hydrate template:
   - Fetch template by `templateId` from `Template` model
   - Fetch contact by `contactId` from `contact` model
   - Call `hydrateTemplate(template.body, contactData, metadata)`
   - Replace `{{firstName}}`, `{{companyName}}`, etc. with actual values
4. Send hydrated email via `/api/outreach/send`

## What Needs to Be Updated

### 1. Update `/api/template/hydrate-with-contact/route.js`
- Change from `outreach_templates` to `Template` model
- Use `template.body`, `template.subject` instead of `template.content`

### 2. Add Template Selection to Compose Page
- Add template selector UI (similar to campaigns page)
- Fetch templates by `ownerId`
- Store selected `templateId` in state
- Add mode toggle: "Manual" vs "Use Template"

### 3. Integrate Hydration into Compose Flow
- When template is selected, show preview with hydrated content
- Before sending, call `/api/template/hydrate-with-contact` OR hydrate client-side
- Send hydrated subject/body instead of manual input

### 4. Variable Mapping
- The `hydrateTemplate()` function already maps variables correctly:
  - `{{firstName}}` → `contact.firstName || contact.goesBy || 'there'`
  - `{{lastName}}` → `contact.lastName`
  - `{{fullName}}` → `contact.fullName || firstName + lastName`
  - `{{companyName}}` → `contact.companyName || 'your company'`
  - `{{title}}` → `contact.title || 'your role'`

## Code References

**Template Hydration Function:**
```javascript
// lib/templateVariables.js:139
export function hydrateTemplate(template, contactData = {}, metadata = {}) {
  const data = {
    firstName: safeContactData.firstName || safeContactData.goesBy || 'there',
    lastName: safeContactData.lastName || '',
    fullName: safeContactData.fullName || `${firstName} ${lastName}`.trim() || 'there',
    companyName: safeContactData.companyName || 'your company',
    title: safeContactData.title || 'your role',
    // ... more mappings
  };
  // Replace {{variableName}} with actual values
}
```

**Current Compose Send (no hydration):**
```javascript
// app/(authenticated)/outreach/compose/page.jsx:132
// Send email directly - no template variable replacement
const response = await api.post('/api/outreach/send', {
  to,
  toName,
  subject,
  body,
  contactId,
  tenantId,
});
```

**Old Hydrate API (needs update):**
```javascript
// app/api/template/hydrate-with-contact/route.js:32
const template = await prisma.outreach_templates.findUnique({
  where: { id: templateId },
  // ❌ Should use Template model
});
```

## Next Steps

1. ✅ Update `/api/template/hydrate-with-contact` to use new `Template` model
2. ✅ Add template selection UI to compose page
3. ✅ Integrate hydration into send flow
4. ✅ Add preview mode to show hydrated content before sending

