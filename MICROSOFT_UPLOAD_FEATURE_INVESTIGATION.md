# Microsoft Upload Feature Investigation

## Summary

The Microsoft upload feature **exists and is functional** with two distinct forks:

1. **Email Contacts** (scraped from emails)
2. **Actual Contacts** (from Microsoft Contacts address book)

## Feature Location

**Main Page**: `/contacts/ingest/microsoft`  
**File**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`

**Access Point**: Users can access this from `/people/load` page, which has an "Import from Microsoft" option.

## Architecture Overview

### 1. Email Contacts Fork (Scraped from Emails)

**Purpose**: Extracts contacts from people you've emailed in Outlook

**API Routes**:
- **Preview**: `GET /api/microsoft/email-contacts/preview`
  - Fetches recent Outlook messages (up to 200)
  - Aggregates unique email senders
  - Filters out automated/business emails
  - Returns up to 50 unique contacts with stats (message count, last seen date)
  - Caches in Redis for 45 minutes
  
- **Save**: `POST /api/microsoft/email-contacts/save`
  - Takes `previewIds` array and `companyHQId`
  - Loads preview from Redis
  - Creates Contact records with email, firstName, lastName
  - Skips contacts that already exist

**Data Retrieved**:
- Email address
- Display name (parsed into firstName/lastName)
- Domain
- Stats: firstSeenAt, lastSeenAt, messageCount

**Filtering**: Automatically filters out:
- Automated email patterns (noreply@, no-reply@, etc.)
- Business domains (sendgrid, mailchimp, stripe, etc.)
- Service notifications

### 2. Actual Contacts Fork (Microsoft Contacts Address Book)

**Purpose**: Imports contacts directly from Microsoft Contacts

**API Routes**:
- **Preview**: `GET /api/microsoft/contacts/preview`
  - Fetches from Microsoft Graph `/me/contacts`
  - Returns up to 50 contacts
  - Includes companyName and jobTitle when available
  - Checks which contacts already exist in database
  - Caches in Redis for 45 minutes
  
- **Save**: `POST /api/microsoft/contacts/save`
  - Takes `previewIds` array and `companyHQId`
  - Loads preview from Redis
  - Creates Contact records
  - Note: companyName and jobTitle are available but not currently stored in Contact model

**Data Retrieved**:
- Email address
- Display name (parsed into firstName/lastName)
- Domain
- Company name (available but not stored)
- Job title (available but not stored)
- Already exists flag

## User Flow

1. User navigates to `/people/load` or directly to `/contacts/ingest/microsoft`
2. User connects Microsoft account (OAuth flow)
3. User selects source:
   - **"Ingest from Emails"** → Uses email-contacts endpoints
   - **"Ingest from Contacts"** → Uses contacts endpoints
4. System loads preview (cached in Redis if available)
5. User selects contacts to import (checkboxes)
6. User clicks "Import Selected"
7. System saves selected contacts to database

## Current Implementation Status

### ✅ Working Features

- Microsoft OAuth connection
- Email contacts preview and save
- Contacts preview and save
- Redis caching for previews
- Contact deduplication (skips existing contacts)
- Source selection UI
- Preview with selection checkboxes

### ⚠️ Known Limitations

1. **Company/Job Title Not Stored**: 
   - Microsoft Contacts provides `companyName` and `jobTitle`
   - These fields are available in preview but not saved to Contact model
   - See comment in `/api/microsoft/contacts/save/route.js` line 152-153

2. **Preview Limit**: 
   - Both forks return maximum 50 contacts per preview
   - User can refresh to get next batch

3. **No Pipeline Creation**:
   - Contacts are created without pipeline/stage
   - May need to create default pipeline after import

## Files Involved

### Frontend
- `app/(authenticated)/contacts/ingest/microsoft/page.jsx` - Main UI page
- `app/(authenticated)/people/load/page.jsx` - Entry point

### Backend API Routes
- `app/api/microsoft/email-contacts/preview/route.js` - Email preview
- `app/api/microsoft/email-contacts/save/route.js` - Email save
- `app/api/microsoft/contacts/preview/route.js` - Contacts preview
- `app/api/microsoft/contacts/save/route.js` - Contacts save
- `app/api/microsoft/login/route.js` - OAuth initiation
- `app/api/microsoft/callback/route.js` - OAuth callback

### Supporting Libraries
- `lib/microsoftGraphClient.js` - Graph API client
- `lib/microsoftAuthUrl.js` - OAuth URL builder
- `lib/microsoftTokenExchange.js` - Token exchange
- `lib/redis.js` - Redis client for caching

## Potential Issues to Check

1. **OAuth Connection**: Verify Microsoft tokens are valid
2. **Redis Connection**: Check if Redis is accessible for caching
3. **Graph API Permissions**: Ensure required scopes are granted
4. **Database**: Verify Contact model structure matches expectations
5. **CompanyHQ Context**: Ensure `companyHQId` is passed correctly

## Testing Checklist

- [ ] Can navigate to `/contacts/ingest/microsoft`
- [ ] Can connect Microsoft account
- [ ] Can see source selection (Email vs Contacts)
- [ ] Email preview loads and shows contacts
- [ ] Contacts preview loads and shows contacts
- [ ] Can select contacts and import them
- [ ] Imported contacts appear in database
- [ ] Duplicate contacts are skipped
- [ ] Preview refreshes correctly

## Next Steps

If the feature is not working, check:

1. **Browser Console**: Look for JavaScript errors
2. **Network Tab**: Check API responses
3. **Server Logs**: Check for backend errors
4. **Microsoft Connection**: Verify OAuth tokens are valid
5. **Redis**: Check if preview caching is working
6. **Database**: Verify contacts are being created

## Related Documentation

- `docs/MICROSOFT_OAUTH_COMPLETE.md` - OAuth flow details
- `docs/MICROSOFT_FRONTEND_AUDIT.md` - Frontend issues
- `docs/MICROSOFT_CALLBACK_AUDIT.md` - Callback route analysis
- `docs/MICROSOFT_INGEST_PAGE_BUTTONS.md` - Button functionality


