# Campaign Refactor Summary

## Overview

Refactored the campaign system to use a **master container pattern** with smart inference and routing. Campaigns are now lightweight containers with "bolt-ons" (like `template_id`) that do the work, eliminating redundant booleans and manual state management.

## Key Changes

### 1. Master Container Pattern

**Before:** Campaigns had redundant fields and manual state management
- Direct email fields (`subject`, `body`) even when using templates
- Manual status management
- No clear separation between container and content source

**After:** Campaigns are lightweight containers
- `template_id` is a "bolt-on" - when present, it's the source of truth
- Manual content fields only used when `template_id` is null
- Status is inferred from field presence and timestamps

### 2. Smart Inference System

Created `lib/services/campaignInference.js` with:

- **`inferCampaignState()`** - Infers boolean states from field presence:
  - `isSaved` = has name + content
  - `isPublished` = status is ACTIVE or SCHEDULED
  - `isReadyToSend` = has contact_list_id + content
  - `contentMode` = 'template' or 'manual'

- **`inferStatus()`** - Suggests status based on:
  - `scheduled_for` in future → SCHEDULED
  - `started_at` exists → ACTIVE
  - `completed_at` exists → COMPLETED
  - Default → DRAFT

- **`getEffectiveEmailContent()`** - Returns content with template precedence:
  - If `template_id` exists → use template content
  - Otherwise → use manual content

### 3. API Updates

**`GET /api/campaigns/[campaignId]`**
- Returns campaign with `state` (inferred properties)
- Returns `effectiveContent` (template takes precedence)
- Returns `suggestedStatus` (auto-inferred)

**`PATCH /api/campaigns/[campaignId]`**
- Smart status inference (auto-progresses when ready)
- When `template_id` is set, template becomes source of truth
- When `template_id` is removed, ensures manual content exists

**`GET /api/campaigns`**
- Returns all campaigns with inferred state
- Each campaign includes `state` and `effectiveContent`

### 4. Frontend Updates

**Campaign Edit Page (`/outreach/campaigns/[campaignId]/edit`)**
- **Template Mode**: When `template_id` exists
  - Shows template content (read-only)
  - Hides manual subject/body fields
  - Template is source of truth
  - Preview text still editable (not in template)

- **Manual Mode**: When `template_id` is null
  - Shows editable subject/body fields
  - All fields editable

**Campaign List Page (`/outreach/campaigns`)**
- Shows inferred state badges:
  - "Saved" - has minimum required fields
  - "Ready to Send" - has audience + content
  - "Template" - using template content
- Uses `effectiveContent.subject` for display

## Architecture Principles

### 1. No Redundant Booleans
- ❌ Removed: `saved`, `published` booleans
- ✅ Added: Inferred from `status` + field presence

### 2. Template ID as Bolt-On
- When `template_id` exists → template is source of truth
- When `template_id` is null → manual content is used
- Frontend automatically switches modes based on `template_id`

### 3. Smart Routing
- Status transitions inferred from field presence
- Auto-progression: DRAFT → SCHEDULED → ACTIVE (when ready)
- No manual status toggles needed

### 4. Effective Content Pattern
- Always use `effectiveContent` for display/sending
- Template content takes precedence when present
- Manual content used as fallback

## Benefits

1. **Simpler Logic**: No manual state management, everything inferred
2. **Less Redundancy**: Template content not duplicated in campaign
3. **Clearer Intent**: `template_id` presence clearly indicates content source
4. **Better UX**: Frontend automatically adapts to template vs manual mode
5. **Maintainable**: Single source of truth for content (template or manual)

## Migration Notes

- Existing campaigns with both `template_id` and manual content will:
  - Use template content (template takes precedence)
  - Manual content preserved but not used when template exists
- Status inference is additive - doesn't break existing status values
- All changes are backward compatible

## Files Changed

1. **New**: `lib/services/campaignInference.js` - Inference service
2. **Updated**: `app/api/campaigns/[campaignId]/route.js` - Smart status inference
3. **Updated**: `app/api/campaigns/route.js` - Include inferred state
4. **Updated**: `app/(authenticated)/outreach/campaigns/[campaignId]/edit/page.jsx` - Template bolt-on pattern
5. **Updated**: `app/(authenticated)/outreach/campaigns/page.jsx` - Show inferred state

## Next Steps (Optional)

1. Add validation endpoint using `validateCampaignReadiness()`
2. Add "Send Now" button that checks `isReadyToSend`
3. Add status transition UI based on `suggestedStatus`
4. Consider removing manual content fields when template_id is set (cleanup)

