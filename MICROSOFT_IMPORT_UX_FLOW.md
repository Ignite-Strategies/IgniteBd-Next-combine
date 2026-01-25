# Microsoft Import UX Flow - What Actually Happens

## The User Journey

### Step 1: User Clicks "Import from Microsoft" (from `/people/load`)

**What they expect:**
- See options to import contacts
- Choose between email or contacts
- Start importing

**What actually happens:**
- Redirected to `/contacts/ingest/microsoft`
- Page loads
- **BLOCKED**: Shows "Connect Microsoft" button
- User can't proceed until connection check completes

### Step 2: Connection Status Check

**Current Flow:**
```
Page Loads
  ↓
useEffect runs → checkMicrosoftStatus()
  ↓
API call to /api/microsoft/status
  ↓
If checkingStatus = true → Show "Checking connection status..."
  ↓
If checkingStatus = false && connected = false → Show "Connect Microsoft" button
  ↓
If checkingStatus = false && connected = true → Show source selection (Email/Contacts)
```

**The Problem:**
- User is BLOCKED from seeing the import options until connection check completes
- If API call fails or is slow → User stuck on "Connect" screen
- Even if tokens exist in DB → User can't proceed if check fails

## Current Blocking Logic

### In `page.jsx`:

```javascript
// Line 266-297: The blocking UI
{checkingStatus ? (
  // BLOCKED: Shows loading spinner
  <div>Checking connection status...</div>
) : isMicrosoftConnected ? (
  // UNBLOCKED: Shows source selection
  <SourceSelection />
) : (
  // BLOCKED: Shows connect button
  <ConnectButton />
)}
```

**The Issue:**
- `checkingStatus` starts as `true` → User sees loading
- If API fails → `checkingStatus` becomes `false`, `connected` stays `false`
- User stuck on "Connect" screen even if tokens exist in DB

### Line 301: Source Selection is GATED:

```javascript
{isMicrosoftConnected && !source && !preview && (
  <SourceSelection />
)}
```

**This means:**
- Source selection ONLY shows if `isMicrosoftConnected === true`
- If connection check fails → User never sees import options
- User is completely blocked from using the feature

## Why This Is Broken

### The Real Problem:

1. **Connection check is a BLOCKING operation**
   - User can't see import options until check completes
   - If check fails → User stuck forever

2. **No fallback or retry mechanism**
   - If API call fails → User has no way to proceed
   - No "Try again" button
   - No manual refresh

3. **No error visibility**
   - If connection check fails silently → User doesn't know why
   - No error message shown
   - User just sees "Connect" button

4. **Tokens exist in DB but check fails**
   - User has tokens saved
   - But connection check API fails or returns wrong result
   - User can't proceed even though they're actually connected

## What Should Happen Instead

### Option 1: Non-Blocking Check (Recommended)

**Show import options immediately, check connection in background:**

```javascript
// Show source selection immediately
<SourceSelection />

// Check connection in background
{checkingStatus && (
  <div className="text-xs text-gray-500">
    Checking connection status...
  </div>
)}

// If not connected, show banner at top
{!checkingStatus && !isMicrosoftConnected && (
  <Banner>Please connect your Microsoft account to import contacts</Banner>
)}
```

**Benefits:**
- User sees options immediately
- Connection check happens in background
- User can see what they'll get
- Not blocked by API call

### Option 2: Optimistic UI

**Assume connected, show options, verify in background:**

```javascript
// Assume connected initially (optimistic)
const [isMicrosoftConnected, setIsMicrosoftConnected] = useState(true);

// Check in background
useEffect(() => {
  checkMicrosoftStatus().then(status => {
    setIsMicrosoftConnected(status.connected);
  });
}, []);

// Show options immediately
<SourceSelection />
```

**Benefits:**
- User sees options immediately
- If not connected, they'll get error when trying to import
- Better UX than blocking

### Option 3: Progressive Enhancement

**Show options, disable until connection verified:**

```javascript
<SourceSelection disabled={checkingStatus || !isMicrosoftConnected} />

{checkingStatus && (
  <div>Verifying connection...</div>
)}
```

**Benefits:**
- User sees what they'll get
- Clear indication of why buttons are disabled
- Can proceed once check completes

## The Actual Import Flow (What User Wants)

### User's Mental Model:

1. Click "Import from Microsoft"
2. See two options:
   - "Get contacts from emails"
   - "Get contacts from address book"
3. Click one
4. See preview of contacts
5. Select contacts to import
6. Click "Import"

### Current Reality:

1. Click "Import from Microsoft"
2. **BLOCKED**: See "Connect Microsoft" button
3. Wait for connection check
4. If check fails → Stuck forever
5. If check succeeds → See options
6. Click option
7. See preview
8. Import

## Why We're Blocking Users

### Current Code Logic:

```javascript
// Line 18: Starts as true
const [checkingStatus, setCheckingStatus] = useState(true);

// Line 21-53: API call
const checkMicrosoftStatus = async () => {
  setCheckingStatus(true);
  try {
    const response = await api.get('/api/microsoft/status');
    setConnectionStatus({...});
  } catch (error) {
    // Sets connected to false
    setConnectionStatus({ connected: false });
  } finally {
    setCheckingStatus(false);
  }
};

// Line 84: Connection status
const isMicrosoftConnected = connectionStatus?.connected || false;

// Line 301: GATED - Only shows if connected
{isMicrosoftConnected && !source && !preview && (
  <SourceSelection />
)}
```

**The Blocking Points:**

1. **Initial state**: `checkingStatus = true` → Shows loading
2. **API call**: Takes time → User waits
3. **If fails**: `connected = false` → User stuck on connect screen
4. **Source selection gated**: Only shows if `isMicrosoftConnected === true`

## Recommended Fix

### Make Connection Check Non-Blocking:

```javascript
// Show source selection immediately
// Check connection in background
// If not connected, show banner but don't block

return (
  <div>
    {/* Show options immediately */}
    <SourceSelection />
    
    {/* Connection status banner (non-blocking) */}
    {checkingStatus ? (
      <Banner type="info">Checking connection...</Banner>
    ) : !isMicrosoftConnected ? (
      <Banner type="warning">
        Please connect your Microsoft account to import contacts.
        <button onClick={handleConnect}>Connect Now</button>
      </Banner>
    ) : null}
  </div>
);
```

### Or: Let User Try Anyway

```javascript
// Show options always
// If not connected, they'll get error when trying to import
// But at least they can see what they'll get

<SourceSelection />

// When they click "Get contacts from emails"
// API will return 401 if not connected
// Show error: "Please connect your Microsoft account first"
```

## Files to Update

1. **`app/(authenticated)/contacts/ingest/microsoft/page.jsx`**
   - Remove blocking logic
   - Show source selection immediately
   - Check connection in background
   - Show banner if not connected (don't block)

2. **Error handling**
   - Show error messages if connection check fails
   - Add retry button
   - Show diagnostics if available

