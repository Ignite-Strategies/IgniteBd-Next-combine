# SendGrid Webhook Fix for 1:1 Emails with Templates

## Issue
Webhook processing for 1:1 emails (especially when using templates) was failing because custom args weren't being extracted correctly from SendGrid webhook events.

## Root Cause
SendGrid converts camelCase custom args to snake_case in webhooks:
- Sent as: `customArgs: { ownerId: "123" }`
- Received as: `custom_arg_owner_id: "123"`

The webhook handler wasn't robustly extracting these fields, causing `ownerId` to be missing, which prevented webhook events from being properly tracked.

## Fixes Applied

### 1. Improved Custom Args Extraction ✅
**File**: `app/api/webhooks/sendgrid/route.js`

**Changes**:
- Simplified custom args extraction to directly access `custom_arg_*` fields
- Removed unnecessary fallback checks that weren't needed
- Added debug logging when `ownerId` is missing (helps identify issues)

**Code**:
```javascript
// Before: Multiple fallback checks that weren't working
const ownerId = event.custom_arg_owner_id || event.custom_args?.ownerId || event['custom_arg_owner_id'];

// After: Direct access (SendGrid always sends as custom_arg_*)
const ownerId = event.custom_arg_owner_id || event['custom_arg_owner_id'];
```

### 2. Enhanced Error Logging ✅
**File**: `app/api/webhooks/sendgrid/route.js`

**Changes**:
- Added detailed logging when `ownerId` is missing
- Logs available custom args to help debug extraction issues
- Better error messages with context

**Why**: Makes it easier to diagnose webhook issues in production.

### 3. Improved Type Conversion ✅
**File**: `app/api/webhooks/sendgrid/route.js`

**Changes**:
- Ensured all custom args are converted to strings when creating email activities
- Prevents type mismatches in database

### 4. Enhanced Sending Logs ✅
**File**: `lib/services/outreachSendService.js`

**Changes**:
- Added logging of customArgs being sent
- Logs sender email/name for verification
- Helps verify that custom args are being sent correctly

## How It Works

### Sending Email (1:1 with Template)
1. User selects template in compose page
2. Template content is hydrated with contact data
3. Email is sent via `/api/outreach/send`
4. Sender (`from`) always comes from `owner.sendgridVerifiedEmail` (NOT from template)
5. Custom args are included: `{ ownerId, contactId, tenantId, ... }`

### Receiving Webhook
1. SendGrid sends webhook event with custom args as `custom_arg_*` fields
2. Webhook handler extracts `custom_arg_owner_id` as `ownerId`
3. Finds or creates `email_activities` record using `messageId`
4. Updates event state and creates `email_events` record

## Important Notes

### Sender/From Field
- **Always** comes from `owner.sendgridVerifiedEmail`
- Templates do NOT override the sender
- If no verified sender exists, email sending fails with clear error

### Custom Args Format
- **Sent**: `customArgs: { ownerId: "123", contactId: "456" }`
- **Received**: `custom_arg_owner_id: "123", custom_arg_contact_id: "456"`
- SendGrid automatically converts camelCase → snake_case

### Template Usage
- Templates only affect email content (subject, body)
- Templates do NOT affect sender/from field
- Templates do NOT affect custom args (always includes ownerId)

## Testing

1. **Send 1:1 email with template**:
   - Select template in compose page
   - Send email
   - Check logs for customArgs being sent
   - Verify webhook receives event with `custom_arg_owner_id`

2. **Check webhook processing**:
   - Look for webhook events in logs
   - Verify `email_activities` record is created/updated
   - Verify `email_events` record is created

3. **Debug missing ownerId**:
   - Check logs for "Webhook event missing ownerId" warnings
   - Review logged custom args to see what SendGrid sent
   - Verify customArgs are being sent correctly in sending logs

## Files Modified

1. `app/api/webhooks/sendgrid/route.js` - Webhook handler improvements
2. `lib/services/outreachSendService.js` - Enhanced logging

## Next Steps

1. Monitor logs for webhook processing
2. Test with actual SendGrid webhooks
3. Verify email_activities and email_events are being created correctly
4. Check for any "missing ownerId" warnings in logs


