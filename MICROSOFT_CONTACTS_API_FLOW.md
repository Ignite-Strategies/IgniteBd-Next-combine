# Microsoft Contacts API Flow

## Current Implementation

### 1. **Get Tokens** (Server-Side)
- Route: `/api/microsoft/contacts/preview`
- Uses: `getValidAccessToken(owner.id)` from `@/lib/microsoftGraphClient`
- What it does:
  - Gets `microsoftAccessToken` from database
  - Checks if expired
  - Auto-refreshes if needed (uses `microsoftRefreshToken`)
  - Returns valid access token

### 2. **Call Microsoft Graph API** (Server-Side)
- Endpoint: `https://graph.microsoft.com/v1.0/me/contacts`
- Query params: `$top=200&$select=displayName,emailAddresses,companyName,jobTitle`
- Headers: `Authorization: Bearer ${accessToken}`
- Gets: List of contacts from user's Microsoft Contacts address book

### 3. **Process Data** (Server-Side)
- Filters out automated emails
- Checks which contacts already exist in database
- Transforms to preview format:
  ```json
  {
    "previewId": "hash",
    "email": "user@example.com",
    "displayName": "John Doe",
    "domain": "example.com",
    "companyName": "Acme Corp",
    "jobTitle": "CEO",
    "alreadyExists": false
  }
  ```

### 4. **Return to Frontend**
- Returns JSON response with preview items
- Frontend displays in UI

## Flow Diagram

```
Frontend (page.jsx)
  ↓
  Calls: GET /api/microsoft/contacts/preview
  ↓
Backend (route.js)
  ↓
  1. Verify Firebase token
  2. Get owner from database
  3. getValidAccessToken(owner.id)
     - Gets access token from DB
     - Refreshes if expired
  ↓
  4. Fetch from Microsoft Graph API
     GET https://graph.microsoft.com/v1.0/me/contacts
     Headers: Authorization: Bearer {token}
  ↓
  5. Process contacts
     - Filter automated emails
     - Check existing contacts
     - Transform to preview format
  ↓
  6. Return JSON to frontend
  ↓
Frontend displays contacts
```

## Token Flow

```
getValidAccessToken(ownerId)
  ↓
  Checks: owner.microsoftAccessToken exists?
  ↓
  Checks: Token expired? (with 5min buffer)
  ↓
  If expired → refreshAccessToken(ownerId)
    - Uses owner.microsoftRefreshToken
    - Calls Microsoft OAuth token endpoint
    - Updates owner.microsoftAccessToken in DB
    - Returns new token
  ↓
  Returns valid access token
```

## Microsoft Graph API Endpoints Used

1. **Contacts**: `GET /v1.0/me/contacts`
   - Returns user's saved contacts from address book
   - Fields: displayName, emailAddresses, companyName, jobTitle

2. **Messages** (for email-contacts): `GET /v1.0/me/messages`
   - Returns email messages
   - Used to extract contacts from email senders

## Current Status

✅ **Tokens**: Retrieved from database, auto-refreshed  
✅ **Server-Side**: All API calls happen server-side  
✅ **Frontend**: Just displays the data  
✅ **Error Handling**: Returns 401 if not connected, 500 on API errors

## Potential Issues

1. **Token Permissions**: Microsoft Graph API requires `Contacts.Read` scope
2. **Rate Limiting**: Microsoft Graph has rate limits
3. **Token Refresh**: If refresh token is invalid, connection breaks
4. **API Errors**: Graph API might return errors we're not handling

