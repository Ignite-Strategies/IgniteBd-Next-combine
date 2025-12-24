# SendGrid Send Endpoint Debugging

## Problem

Getting 500 errors when trying to send emails via `/api/outreach/send`, even though:
- Verified email is loaded from DB successfully
- Email was verified with SendGrid using another API

## Root Cause Analysis

The issue could be:
1. **Case sensitivity mismatch** - Email stored as `Adam@IgniteStrategies.co` but SendGrid verified as `adam@ignitestrategies.co`
2. **Verification status changed** - Email was verified but then unverified/removed in SendGrid
3. **Email format issues** - Invalid characters or formatting in stored email
4. **SendGrid API rejection** - SendGrid rejecting for reasons not caught by our checks

## Changes Made

### 1. Enhanced Logging in Send Route

**File**: `app/api/outreach/send/route.js`

Added detailed logging:
- Logs verified sender from DB
- Logs email format validation
- Logs double-check verification with SendGrid
- Logs all parameters before sending

### 2. Email Format Validation

**Files**: 
- `app/api/outreach/send/route.js`
- `lib/services/outreachSendService.js`

Added email format validation:
- Validates email format before using
- Returns clear error if format is invalid
- Normalizes email to lowercase for consistency

### 3. Pre-Send Verification Check

**File**: `app/api/outreach/send/route.js`

Added double-check before sending:
- Verifies sender with SendGrid API right before sending
- Catches cases where sender was removed/unverified
- Provides clear error messages if verification fails
- Continues with send if verification check fails (SendGrid will reject anyway)

### 4. Email Normalization

**File**: `lib/services/outreachSendService.js`

Normalizes email addresses:
- Converts to lowercase for consistency
- Trims whitespace
- Ensures consistent format for SendGrid

## Debugging Steps

### 1. Check Server Logs

Look for these log messages when sending:

```
📋 Verified sender from DB: { fromEmail: '...', fromName: '...', ownerId: '...' }
🔍 Double-checking sender verification with SendGrid before sending...
✅ Sender verification confirmed with SendGrid
📧 Preparing SendGrid message: { fromEmail: '...', to: '...', ... }
```

### 2. Check for Verification Mismatch

If you see:
```
❌ Sender verification check failed: { found: true, verified: false }
```

This means:
- Sender exists in SendGrid
- But `verified === false`
- Need to complete verification in SendGrid dashboard

### 3. Check SendGrid Error Details

If SendGrid rejects, look for:
```
📋 SendGrid error details: {
  statusCode: 400,
  errorMessage: '...',
  errorField: 'from.email',
  ...
}
```

Common SendGrid errors:
- `"The from address does not match a verified Sender Identity"` - Sender not verified
- `"Invalid email address"` - Email format issue
- `"Sender email is locked"` - Sender locked in SendGrid

### 4. Verify Email in SendGrid Dashboard

1. Go to SendGrid Dashboard → Settings → Sender Authentication
2. Find the sender email (`adam@ignitestrategies.co`)
3. Check status:
   - ✅ **Verified** - Should work
   - ⚠️ **Pending** - Needs verification click
   - ❌ **Unverified** - Needs verification
   - 🔒 **Locked** - Contact SendGrid support

### 5. Check Database vs SendGrid

Compare what's in DB vs SendGrid:

**Database** (`owners.sendgridVerifiedEmail`):
```sql
SELECT id, sendgridVerifiedEmail, sendgridVerifiedName 
FROM owners 
WHERE firebaseId = '...';
```

**SendGrid API**:
```bash
GET /v3/senders
# Look for matching email, check verified === true
```

## Common Issues

### Issue 1: Case Sensitivity

**Symptom**: Email verified but SendGrid rejects

**Solution**: Emails are now normalized to lowercase

### Issue 2: Verification Status Changed

**Symptom**: Was verified, now getting rejection

**Solution**: Pre-send check now catches this

### Issue 3: Email Format Issues

**Symptom**: Invalid email format errors

**Solution**: Added format validation

### Issue 4: SendGrid API Permissions

**Symptom**: Can't check verification status

**Solution**: Verification check is optional - if it fails, we continue and SendGrid will reject if needed

## Testing

1. **Test with verified sender**:
   - Should see: `✅ Sender verification confirmed with SendGrid`
   - Should send successfully

2. **Test with unverified sender**:
   - Should see: `❌ Sender verification check failed`
   - Should get clear error message
   - Should NOT attempt to send

3. **Test with missing sender**:
   - Should see: `❌ No verified sender email found`
   - Should get clear error message

## Next Steps

1. Check server logs for actual error messages
2. Verify sender in SendGrid dashboard
3. Compare DB email with SendGrid verified email
4. Check SendGrid error details in logs
5. Test with the enhanced logging to see where it fails

## Related Files

- `app/api/outreach/send/route.js` - Send endpoint
- `lib/services/outreachSendService.js` - SendGrid service
- `lib/sendgridSendersApi.js` - SendGrid API client
- `app/api/outreach/verified-senders/route.js` - Verified sender management

