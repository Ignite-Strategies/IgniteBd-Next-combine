# SendGrid Logic Audit

## Overview
This document audits the SendGrid integration to identify potential issues and ensure everything is working correctly.

## Architecture

### Core Components

1. **`lib/sendgridClient.js`** - General email sending
   - `sendEmail()` - Single email
   - `sendBatchEmails()` - Batch emails with delays
   - Uses: `/api/email/send`

2. **`lib/services/outreachSendService.js`** - Outreach-specific sending
   - `sendOutreachEmail()` - Outreach emails with tracking
   - Uses: `/api/outreach/send`
   - Includes customArgs for webhook mapping

3. **`lib/sendgridSendersApi.js`** - Sender verification management
   - `listSenders()` - List all senders
   - `createVerifiedSender()` - Create and verify sender
   - `getVerifiedSender()` - Get sender details

4. **`app/api/webhooks/sendgrid/route.js`** - Webhook handler
   - Processes SendGrid events
   - Updates email_activities and email_events tables

## Potential Issues

### 1. Multiple SendGrid Initializations
**Issue**: SendGrid API key is set in multiple places:
- `lib/sendgridClient.js` (line 6)
- `lib/services/outreachSendService.js` (line 6)

**Impact**: Redundant but harmless. However, if one fails to initialize, the other might still work, causing inconsistent behavior.

**Recommendation**: Centralize initialization in a single module.

### 2. Sender Verification Enforcement
**Current State**: 
- `/api/outreach/send` enforces verified sender (line 66-74)
- `sendOutreachEmail()` enforces verified sender (line 56-58)
- `/api/email/send` does NOT enforce verified sender (uses env defaults)

**Potential Issue**: Two different behaviors for email sending:
- Outreach emails: Requires verified sender
- General emails: Falls back to env defaults

**Recommendation**: Decide on consistent behavior or document the difference clearly.

### 3. Error Handling Inconsistencies
**Issue**: Different error handling patterns:
- `sendgridClient.js`: Basic error handling
- `outreachSendService.js`: Detailed error handling with specific status codes
- `sendgridSendersApi.js`: Helpful error messages for permissions

**Recommendation**: Standardize error handling across all SendGrid modules.

### 4. Webhook Signature Verification
**Issue**: Webhook signature verification is optional (line 22-38 in webhook route)
- Only verifies if `SENDGRID_SIGNING_KEY` is set
- Warns but doesn't fail if signature is missing

**Security Concern**: Without signature verification, webhook could be spoofed.

**Recommendation**: Make signature verification required in production.

### 5. Message ID Extraction
**Issue**: Message ID extraction might fail:
- `sendgridClient.js` line 81: `response[0].headers['x-message-id']`
- `outreachSendService.js` line 102: `response[0].headers['x-message-id']`
- Webhook handler line 63: `messageId?.split('@')[0]`

**Potential Issue**: If SendGrid response format changes, message ID extraction could fail silently.

### 6. Custom Args Naming
**Issue**: Custom args use snake_case in webhook but camelCase in code:
- Code: `customArgs: { ownerId, contactId, ... }`
- Webhook: `custom_arg_owner_id`, `custom_arg_contact_id`

**Status**: This is correct - SendGrid converts camelCase to snake_case automatically.

### 7. Database Schema Dependencies
**Dependencies**:
- `owners` table: `sendgridVerifiedEmail`, `sendgridVerifiedName`
- `email_activities` table: For tracking sent emails
- `email_events` table: For tracking webhook events

**Potential Issue**: If schema changes, code might break silently.

## Testing Checklist

- [ ] Test single email send via `/api/email/send`
- [ ] Test batch email send via `/api/email/send`
- [ ] Test outreach email send via `/api/outreach/send`
- [ ] Test sender verification flow
- [ ] Test webhook event processing
- [ ] Test error handling for missing API key
- [ ] Test error handling for unverified sender
- [ ] Test error handling for SendGrid API errors
- [ ] Test message ID extraction and webhook matching

## Common Error Scenarios

1. **Missing API Key**
   - Error: "SendGrid API key not configured"
   - Location: All SendGrid modules
   - Fix: Set `SENDGRID_API_KEY` env var

2. **Unverified Sender**
   - Error: "Sender not verified"
   - Location: `/api/outreach/send`
   - Fix: Verify sender via `/api/owner/sender/verify`

3. **Insufficient API Permissions**
   - Error: "SendGrid API access forbidden"
   - Location: `sendgridSendersApi.js`
   - Fix: Update API key permissions in SendGrid dashboard

4. **Credits Exceeded**
   - Error: "SendGrid account has exceeded its email credits"
   - Location: `outreachSendService.js`
   - Fix: Upgrade SendGrid plan or wait for reset

5. **Webhook Signature Mismatch**
   - Warning: "SendGrid webhook signature verification failed"
   - Location: `/api/webhooks/sendgrid`
   - Fix: Verify `SENDGRID_SIGNING_KEY` matches SendGrid dashboard

## Recommendations

1. **Centralize SendGrid Initialization**
   - Create `lib/sendgridInit.js` to handle all initialization
   - Export initialized `sgMail` instance

2. **Standardize Error Handling**
   - Create `lib/sendgridErrors.js` with error classes
   - Use consistent error messages and status codes

3. **Add Comprehensive Logging**
   - Log all SendGrid API calls
   - Log webhook events
   - Log errors with context

4. **Add Type Safety**
   - Convert to TypeScript or add JSDoc types
   - Validate parameters before API calls

5. **Add Integration Tests**
   - Test email sending end-to-end
   - Test webhook processing
   - Test error scenarios

6. **Documentation**
   - Document all SendGrid endpoints
   - Document error codes and meanings
   - Document webhook event types

## Next Steps

1. Identify specific error or issue user is experiencing
2. Check logs for SendGrid-related errors
3. Test each component individually
4. Fix identified issues
5. Add monitoring/alerting for SendGrid failures


