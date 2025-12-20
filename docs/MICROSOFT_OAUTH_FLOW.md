# Microsoft OAuth Flow - Contacts Ingest

## Complete Flow

### 1. Frontend: User Initiates OAuth
**Location:** `/contacts/ingest/microsoft`

**Steps:**
- User clicks "Connect Microsoft Account"
- Frontend calls `/api/microsoft/status` (via Axios with Firebase token)
- Gets `ownerId` from response (resolved from Firebase UID server-side)
- Redirects: `window.location.href = '/api/microsoft/login?ownerId=xxx'`

**Why direct navigation?**
- OAuth redirects can't be followed via AJAX (CORS)
- Must use `window.location.href` for browser redirect

### 2. Server: Login Route
**Location:** `/api/microsoft/login`

**Steps:**
- Receives `ownerId` from query param
- Encodes `ownerId` in OAuth state parameter
- Redirects to Microsoft OAuth: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?...`

**No authentication required:**
- This is a redirect-only endpoint
- Microsoft will authenticate the user

### 3. Microsoft: User Authentication
**Location:** Microsoft's servers

**Steps:**
- User enters email/password
- Microsoft validates credentials
- Microsoft redirects back with: `?code=XYZ&state=encodedState`

**What Microsoft returns:**
- `code` = authorization code (NOT access token)
- `state` = our encoded state (contains ownerId)

### 4. Server: Callback Route
**Location:** `/api/microsoft/callback`

**Steps:**
- Receives `?code=XYZ&state=encodedState` from Microsoft
- Decodes `ownerId` from state parameter
- Exchanges `code` for `access_token` + `refresh_token` (server-side)
- Saves tokens to Owner record (using ownerId)
- Redirects to: `/contacts/ingest/microsoft?success=1`

**Server-side only:**
- Token exchange requires `client_secret` (never exposed to client)
- Database writes happen server-side

### 5. Frontend: Success Handling
**Location:** `/contacts/ingest/microsoft`

**Steps:**
- Sees `?success=1` in URL params
- Clears URL params
- Refreshes Microsoft status (calls `/api/microsoft/status`)
- Loads preview (calls `/api/microsoft/email-contacts/preview`)

## Environment Variables

### Client-Side (Browser)
- `NEXT_PUBLIC_BACKEND_URL` - Leave empty (uses relative URLs for Next.js API routes)
- Axios automatically uses `window.location.origin` for `/api/*` routes

### Server-Side (API Routes)
- `APP_URL` - Full URL of the app (e.g., `https://app.ignitegrowth.biz`)
  - Used for redirecting back to frontend after OAuth
- `MICROSOFT_REDIRECT_URI` - Full URL for OAuth callback (e.g., `https://app.ignitegrowth.biz/api/microsoft/callback`)
  - Must match exactly what's registered in Azure AD
- `AZURE_CLIENT_ID` - App registration client ID
- `AZURE_CLIENT_SECRET` - App registration secret (server-side only)
- `AZURE_TENANT_ID` - NEVER used for user login (only for admin operations)

## Key Points

1. **ownerId comes from Firebase auth ONLY**
   - Frontend gets it from `/api/microsoft/status` (which resolves from Firebase UID)
   - Passed as query param to login route
   - Encoded in OAuth state parameter
   - Decoded in callback to save tokens

2. **No server URL needed for client-side**
   - Client uses relative URLs (`/api/*`)
   - Axios automatically uses `window.location.origin`

3. **Server-side needs full URLs**
   - `MICROSOFT_REDIRECT_URI` - Microsoft needs full URL to redirect back
   - `APP_URL` - We need full URL to redirect back to frontend

4. **OAuth flow is server-side**
   - Token exchange happens server-side (requires `client_secret`)
   - Database writes happen server-side
   - Frontend only initiates and receives success/error

