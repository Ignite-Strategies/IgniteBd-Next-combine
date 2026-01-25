# Microsoft Import UI Decision Tree - EXACT CODE PATH

## The Critical Variable

**Line 84**: `const isMicrosoftConnected = connectionStatus?.connected || false;`

This ONE variable controls EVERYTHING.

## What Shows "Connect Microsoft" Button

**Lines 298-311**: The "Connect Microsoft" card
```javascript
) : (
  <div>
    <p>Connect your Microsoft account...</p>
    <button>Connect Microsoft</button>
  </div>
)}
```

**Condition**: `!isMicrosoftConnected` (line 298)

## What Shows the Fork UX ("Choose Import Source")

**Lines 315-384**: The source selection cards
```javascript
{!source && !preview && (
  <div>
    <h2>Choose Import Source</h2>
    <button>Ingest from Emails</button>
    <button>Ingest from Contacts</button>
  </div>
)}
```

**Condition**: `!source && !preview` (line 315)
- This ALWAYS shows (we fixed it to not be gated)
- But buttons are DISABLED if `!isMicrosoftConnected` (lines 347, 366)

## The Flow

### Step 1: Page Loads
```javascript
// Line 17: connectionStatus starts as null
const [connectionStatus, setConnectionStatus] = useState(null);

// Line 18: checkingStatus starts as true
const [checkingStatus, setCheckingStatus] = useState(true);

// Line 84: isMicrosoftConnected = null?.connected || false = false
const isMicrosoftConnected = connectionStatus?.connected || false;
```

**Result**: `isMicrosoftConnected = false`

### Step 2: useEffect Runs (Line 56-65)
```javascript
useEffect(() => {
  // Get ownerId from localStorage
  const storedOwnerId = localStorage.getItem('ownerId');
  if (storedOwnerId) setOwnerId(storedOwnerId);
  
  // Check Microsoft connection status from API
  checkMicrosoftStatus();
}, [checkMicrosoftStatus]);
```

**What happens**: Calls `checkMicrosoftStatus()`

### Step 3: checkMicrosoftStatus() Runs (Line 21-53)
```javascript
const checkMicrosoftStatus = useCallback(async () => {
  setCheckingStatus(true);  // Line 22: Shows "Checking connection status..."
  try {
    const response = await api.get('/api/microsoft/status');  // Line 24: API call
    setConnectionStatus({
      connected: response.data.connected || false,  // Line 27: Sets connectionStatus
      // ...
    });
  } catch (error) {
    // Line 38: Sets connected: false on error
    setConnectionStatus({
      connected: false,
      // ...
    });
  } finally {
    setCheckingStatus(false);  // Line 51: Hides loading
  }
}, []);
```

**Critical Points**:
- If API call succeeds → `connectionStatus.connected = true/false` from API
- If API call fails → `connectionStatus.connected = false`
- After this, `checkingStatus = false`

### Step 4: UI Renders Based on State

**After API call completes**:

1. **If `connectionStatus.connected === true`**:
   - Line 285: `isMicrosoftConnected = true`
   - Line 285-297: Shows "Connected as email@..." with Disconnect button
   - Line 315: Source selection shows
   - Line 347, 366: Buttons are ENABLED

2. **If `connectionStatus.connected === false`**:
   - Line 84: `isMicrosoftConnected = false`
   - Line 298-311: Shows "Connect Microsoft" button
   - Line 315: Source selection shows (but buttons disabled)
   - Line 325-341: Shows yellow banner "Please connect your Microsoft account"

## The Problem: Why You're Seeing "Connect Microsoft"

### Scenario 1: API Call Never Completes
- `checkingStatus` stays `true` forever
- Shows "Checking connection status..." spinner
- Never gets to show source selection

### Scenario 2: API Call Fails
- `checkMicrosoftStatus()` catches error
- Sets `connectionStatus.connected = false`
- `isMicrosoftConnected = false`
- Shows "Connect Microsoft" button

### Scenario 3: API Returns `connected: false`
- API call succeeds
- But `/api/microsoft/status` returns `{ connected: false }`
- `isMicrosoftConnected = false`
- Shows "Connect Microsoft" button

## How to Debug

### Check Browser Console
1. Open DevTools → Console
2. Look for:
   - `Failed to check Microsoft status:` (line 37)
   - Any API errors

### Check Network Tab
1. Open DevTools → Network
2. Look for request to `/api/microsoft/status`
3. Check:
   - Did it complete? (Status 200?)
   - What did it return? (`{ connected: true }` or `{ connected: false }`?)

### Check React State
1. Add console.log in component:
```javascript
console.log('🔍 DEBUG:', {
  checkingStatus,
  connectionStatus,
  isMicrosoftConnected,
});
```

### Check API Response
The `/api/microsoft/status` endpoint should return:
```json
{
  "connected": true,  // ← This is what matters!
  "email": "adam@ignite...",
  "tokens": { ... },
  "diagnostics": { ... }
}
```

If `connected: false`, check:
- Does database have `microsoftAccessToken`?
- Does database have `microsoftRefreshToken`?
- What does `/api/debug/microsoft-status` return?

## The Exact Code That Determines What You See

### Shows "Connect Microsoft" Button:
**File**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`
**Line**: 298
**Condition**: `!isMicrosoftConnected`
**Which means**: `connectionStatus?.connected !== true`

### Shows Source Selection (Fork UX):
**File**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`
**Line**: 315
**Condition**: `!source && !preview`
**Always shows now** (we fixed it)

### Buttons Are Disabled:
**File**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`
**Lines**: 347, 366
**Condition**: `disabled={!isMicrosoftConnected}`
**Which means**: Buttons disabled if `connectionStatus?.connected !== true`

## The Root Cause

**Line 84**: `const isMicrosoftConnected = connectionStatus?.connected || false;`

If `connectionStatus` is:
- `null` → `isMicrosoftConnected = false` ❌
- `{ connected: false }` → `isMicrosoftConnected = false` ❌
- `{ connected: true }` → `isMicrosoftConnected = true` ✅

**The API call at line 24** (`api.get('/api/microsoft/status')`) must:
1. Complete successfully
2. Return `{ connected: true }`
3. Set `connectionStatus` state
4. Then `isMicrosoftConnected` becomes `true`

If ANY of these fail, you see "Connect Microsoft" instead of the fork UX.

