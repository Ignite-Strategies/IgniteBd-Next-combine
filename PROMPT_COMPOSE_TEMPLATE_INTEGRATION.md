# Template Integration in Outreach Compose - Implementation Summary

## ✅ Implementation Complete

Template selection and hydration have been integrated into the outreach compose flow using a **server-side payload pattern** that matches the sandbox architecture.

## Implementation Approach

We implemented template support using the **build-payload → preview → send** flow:

1. **Template selection** happens in the compose page UI
2. **Template hydration** happens server-side in `/api/outreach/build-payload`
3. **Hydrated content** becomes part of the JSON payload stored in Redis
4. **Preview** shows the exact payload before sending
5. **Send** uses the same payload (invariant: payload never changes)

This approach ensures:
- Templates become part of the JSON payload (not assigned separately)
- Preview matches exactly what will be sent
- No client-side hydration needed

## Current Implementation

### ✅ What's Implemented:

1. **Template Selection in Compose Page**
   - Template dropdown selector
   - Auto-fills subject/body when template is selected
   - Templates loaded from `/api/templates?ownerId=${ownerId}`

2. **Server-Side Template Hydration in Build-Payload**
   - `/api/outreach/build-payload` accepts optional `templateId`
   - When `templateId` is provided:
     - Fetches template from `prisma.template` (new model)
     - Fetches contact data if `contactId` is provided
     - Hydrates template subject and body with contact variables
     - Includes hydrated content in the payload JSON
   - Template hydration happens ONCE when building payload

3. **Preview Page**
   - Shows exact payload from Redis
   - User can review before sending
   - Send button triggers `/api/outreach/send` with `requestId`

4. **Payload Pattern Flow**
   ```
   Compose → Build Payload (hydrates template) → Redis (stores JSON)
   ↓
   Preview Page → Reads from Redis → Shows exact payload
   ↓
   Send → Reads same payload from Redis → Sends to SendGrid
   ```

### 📋 Code Location:

- **Compose Page:** `app/(authenticated)/outreach/compose/page.jsx`
  - Template selector (lines ~240-260)
  - Build-payload call with templateId (line ~180)
  
- **Build-Payload Route:** `app/api/outreach/build-payload/route.js`
  - Template hydration logic (lines ~71-130)
  - Uses `prisma.template` model
  - Uses `hydrateTemplate()` from `lib/templateVariables.js`

- **Preview Page:** `app/(authenticated)/outreach/compose/preview/page.jsx`
  - Displays payload from Redis
  - Send functionality

## Template Model Schema

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

## Variable Hydration

The `hydrateTemplate()` function in `lib/templateVariables.js` handles:
- `{{firstName}}` → `contact.firstName || contact.goesBy || 'there'`
- `{{lastName}}` → `contact.lastName`
- `{{fullName}}` → `contact.fullName || firstName + lastName`
- `{{companyName}}` → `contact.companyName || 'your company'`
- `{{title}}` → `contact.title || 'your role'`
- `{{timeSinceConnected}}` → calculated from `contact.updatedAt`

## Usage Flow

1. User selects contact (optional but recommended for variable hydration)
2. User optionally selects template
   - If template selected: subject/body auto-filled with template content
   - Variables like `{{firstName}}` show as-is in the form
3. User clicks "Build & Preview"
4. Server builds payload:
   - If `templateId` provided: hydrates template with contact data
   - If no `templateId`: uses manual subject/body
   - Saves complete SendGrid payload to Redis
   - Returns `requestId`
5. Preview page shows exact payload (variables already replaced)
6. User clicks "Send Email"
7. Server reads same payload from Redis and sends to SendGrid

## Differences from Original Plan

The original plan suggested:
- Client-side hydration via `/api/template/hydrate-with-contact`
- Mode toggle (Manual vs Template)
- Hydrated content shown in form fields before sending
- Direct send (not using build-payload)

**Actual implementation:**
- Server-side hydration in build-payload route
- Simple template selector (no mode toggle needed)
- Template content shown in form, but hydration happens server-side
- Uses build-payload → preview → send flow (matches sandbox pattern)

## Notes

- Templates are **part of the JSON payload**, not assigned as a separate request ID (deprecated pattern)
- The `/api/template/hydrate-with-contact` route still exists but is not used by the compose flow
- That route still uses old `outreach_templates` model and may need updating for other use cases
- The compose flow uses the new `Template` model via build-payload route

## Testing Checklist

- [x] Can select template from dropdown
- [x] Template subject/body loads when selected
- [x] Variables are replaced with contact data (server-side)
- [x] Hydrated content shows in preview
- [x] Email sends with hydrated content
- [x] Manual mode still works (no template selected)
- [x] Preview shows exactly what will be sent

## Future Enhancements (Optional)

- Add client-side preview of hydrated template before building payload (nice-to-have)
- Show template variables in form with placeholders (e.g., "Hi {{firstName}},")
- Add "Use Template" vs "Write Manually" mode toggle for clearer UX
- Update `/api/template/hydrate-with-contact` route to use new Template model for other use cases
