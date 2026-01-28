# Microsoft Contacts Import - Modular Flow

## New Architecture

### Flow: Preview → Review → Save

1. **Preview Page** (`/contacts/ingest/microsoft`)
   - User selects contacts from preview
   - Click "Review Selected" → navigates to review page
   - Stores selected items in sessionStorage

2. **Review Page** (`/contacts/ingest/microsoft/review`) **NEW**
   - Shows how contacts will map to Contact model
   - Shows which contacts already exist in database
   - User can review before saving
   - Click "Save" → actually saves contacts

3. **Save** (via API)
   - Uses `contactFromPreviewService` for mapping
   - Creates contacts in database
   - Returns to preview page with success message

## New Service: `contactFromPreviewService.js`

**Location**: `/lib/contactFromPreviewService.js`

**Functions**:
- `mapPreviewItemToContact(previewItem)` - Maps preview item to Contact data structure
- `checkExistingContacts(emails, companyHQIds)` - Checks which emails already exist
- `prepareContactsForReview(previewItems, companyHQIds)` - Prepares contacts for review page

## New API Route: `/api/microsoft/contacts/review`

**Purpose**: Prepare selected preview items for review
- Maps preview items to Contact structure
- Checks which contacts already exist
- Returns mapped contacts with `alreadyExists` flag

## Benefits

1. **Modular** - Clear separation: preview → review → save
2. **Reusable** - `contactFromPreviewService` can be used by other import sources
3. **Clear UX** - User sees exactly what will be saved before saving
4. **Better Error Handling** - Can catch mapping issues before save
5. **Transparent** - Shows which contacts already exist before import

## Changes Made

1. ✅ Created `contactFromPreviewService.js` - Centralized mapping logic
2. ✅ Created `/api/microsoft/contacts/review` - Review preparation endpoint
3. ✅ Created `/contacts/ingest/microsoft/review` page - Review UI
4. ✅ Updated preview page - "Review Selected" button instead of direct save
5. ✅ Updated save routes - Use service for mapping
6. ✅ Removed "alreadyExists" check from preview routes (moved to review step)

## Next Steps

- Test the full flow: Preview → Review → Save
- Consider adding ability to edit mapping in review page
- Consider adding bulk actions (select all new, deselect all existing, etc.)
