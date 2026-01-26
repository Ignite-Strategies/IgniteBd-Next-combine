# Microsoft API Call Optimization

## Current Flow (Optimized)

### 1. Page Load - Check Connection Once ✅

**When**: On component mount and after OAuth callback

**What**: Single call to `/api/microsoft/status`

**Purpose**: 
- Show connection status in UI (top right indicator)
- Determine if "Connect" button should show

**Code**:
```javascript
// Only on mount and after OAuth
useEffect(() => {
  const checkConnection = async () => {
    const response = await api.get('/api/microsoft/status');
    setIsConnected(response.data?.connected || false);
  };
  checkConnection();
}, []);
```

### 2. User Clicks Card - Direct API Call ✅

**When**: User clicks "Ingest from Emails" or "Ingest from Contacts"

**What**: Direct call to the actual API endpoint

**No connection check**: We don't check connection first - just call the API

**Code**:
```javascript
// User clicks card → Direct API call
const handleLoadPreview = async (selectedSource) => {
  const endpoint = selectedSource === 'email' 
    ? '/api/microsoft/email-contacts/preview'
    : '/api/microsoft/contacts/preview';
  
  // Call API directly - no connection check
  const response = await api.get(endpoint);
  
  // If 401, handle "not connected" error
  // If success, we know we're connected
};
```

### 3. Error Handling - Discover Connection Status ✅

**If API returns 401**:
- Show "not connected" error
- Update connection status to `false`
- Show "Connect" button

**If API succeeds**:
- Show preview data
- Update connection status to `true`
- Hide "Connect" button

## Why This Works

1. **No Redundant Checks**
   - We don't check connection before each API call
   - The API itself will return 401 if not connected
   - One less API call per user action

2. **Single Source of Truth**
   - Connection status checked once on page load
   - Updated when API calls succeed/fail
   - No duplicate connection checks

3. **Better UX**
   - User clicks card → Immediate API call
   - If not connected → Clear error message
   - If connected → Data loads immediately

## API Call Sequence

### Scenario 1: User is Connected

```
1. Page loads
   → GET /api/microsoft/status
   → Returns: { connected: true }
   → UI shows: "Connected" indicator

2. User clicks "Ingest from Emails"
   → GET /api/microsoft/email-contacts/preview
   → Returns: { success: true, items: [...] }
   → UI shows: Preview data
```

**Total API calls**: 2 (status + preview)

### Scenario 2: User is NOT Connected

```
1. Page loads
   → GET /api/microsoft/status
   → Returns: { connected: false }
   → UI shows: "Connect" button

2. User clicks "Ingest from Emails"
   → GET /api/microsoft/email-contacts/preview
   → Returns: 401 Unauthorized
   → UI shows: "Not connected" error + "Connect" button
```

**Total API calls**: 2 (status + preview attempt)

### Scenario 3: User Connects After Page Load

```
1. Page loads
   → GET /api/microsoft/status
   → Returns: { connected: false }

2. User clicks "Connect"
   → OAuth flow...

3. OAuth callback redirects back
   → GET /api/microsoft/status (after OAuth)
   → Returns: { connected: true }
   → UI shows: "Connected" indicator

4. User clicks "Ingest from Emails"
   → GET /api/microsoft/email-contacts/preview
   → Returns: { success: true, items: [...] }
```

**Total API calls**: 3 (status + status after OAuth + preview)

## Pages That Check Connection

### 1. `/contacts/ingest/microsoft` ✅

**Connection check**: Once on mount, once after OAuth callback

**API calls**: Direct to preview endpoints (no connection check)

**Flow**:
- Load page → Check connection status
- Click card → Call API directly
- Handle 401 → Show error

### 2. `/settings` ✅

**Connection check**: Once on mount, once after OAuth callback

**Purpose**: Show Microsoft connection status in settings

**Flow**:
- Load page → Check connection status
- Show status in UI
- Allow connect/disconnect

## What We DON'T Do

❌ **Don't check connection before each API call**
```javascript
// BAD - redundant check
const checkConnection = await api.get('/api/microsoft/status');
if (checkConnection.data.connected) {
  const preview = await api.get('/api/microsoft/contacts/preview');
}
```

✅ **Do call API directly**
```javascript
// GOOD - let API handle authentication
const preview = await api.get('/api/microsoft/contacts/preview');
// If 401, handle error
// If success, we're connected
```

## Benefits

1. **Fewer API Calls**
   - No connection check before each action
   - One less round trip per user interaction

2. **Faster UX**
   - User clicks → Immediate API call
   - No waiting for connection check first

3. **Simpler Code**
   - No conditional logic: "if connected, then call API"
   - Just call API, handle errors

4. **Single Source of Truth**
   - Connection status from actual API responses
   - No sync issues between status and actual API calls

## Implementation Details

### Connection Status Check

**When**:
- Component mount (once)
- After OAuth callback (once)

**Where**:
- `/contacts/ingest/microsoft` page
- `/settings` page

**API**: `/api/microsoft/status`

### Direct API Calls

**When**: User interacts with cards/buttons

**Where**:
- "Ingest from Emails" card → `/api/microsoft/email-contacts/preview`
- "Ingest from Contacts" card → `/api/microsoft/contacts/preview`
- Save operations → `/api/microsoft/email-contacts/save` or `/api/microsoft/contacts/save`

**Error Handling**:
- 401 → Not connected (show error, update status)
- Other errors → API error (show error message)

## Summary

✅ **Connection check**: Only on page load and after OAuth  
✅ **API calls**: Direct, no connection check first  
✅ **Error handling**: 401 = not connected, update status  
✅ **Result**: Fewer API calls, faster UX, simpler code

---

**Status**: ✅ **Optimized** - Connection checked once, APIs called directly
