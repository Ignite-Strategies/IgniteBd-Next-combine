# Microsoft Frontend Audit - Full Analysis

**File:** `/app/(authenticated)/contacts/ingest/microsoft/page.jsx`

## Issues Found

### 🔴 CRITICAL ISSUE #1: useEffect Infinite Loop Risk

**Location:** Lines 97-108

```javascript
const isConnected = !!owner?.microsoftAccessToken; // Computed on every render

useEffect(() => {
  if (!ownerId || !owner) return;
  
  if (isConnected && !preview) {
    loadPreview();
  }
}, [ownerId, owner, isConnected]); // ⚠️ isConnected changes when owner changes!
```

**Problem:**
- `isConnected` is computed on every render (line 23)
- When `owner` changes, `isConnected` changes
- `isConnected` is in the dependency array
- This causes the effect to re-run when `owner` updates
- Even though we check `!preview`, if `preview` gets cleared somehow, it loops

**Fix:** Remove `isConnected` from dependencies, compute it inside the effect

### 🔴 CRITICAL ISSUE #2: Unused Function

**Location:** Lines 118-128

```javascript
const handleConnectMicrosoft = () => {
  if (!ownerId) {
    alert('Please wait for authentication to complete.');
    return;
  }
  
  const loginUrl = `/api/microsoft/login?ownerId=${ownerId}`;
  console.log('🚀 REDIRECTING NOW to:', loginUrl);
  window.location.href = loginUrl;
};
```

**Problem:**
- This function is defined but NOT used
- The button on line 268 uses inline `window.location.href = '/api/microsoft/login'` (correct)
- The "Reconnect" button on line 250 uses `handleConnectMicrosoft` (wrong - passes ownerId)
- Function still passes `ownerId` in URL (shouldn't per contract)

**Fix:** Remove this function, use direct redirect everywhere

### 🟡 ISSUE #3: Missing Dependency Warning

**Location:** Line 108

```javascript
}, [ownerId, owner, isConnected]); // Removed loadPreview and preview from deps
```

**Problem:**
- `loadPreview` is called but not in dependencies
- This is intentional to prevent loops, but ESLint will warn
- `preview` is checked but not in dependencies

**Fix:** Add ESLint disable comment or restructure

### 🟡 ISSUE #4: Success Handler Doesn't Refresh Owner

**Location:** Lines 37-61

```javascript
if (success === '1') {
  window.history.replaceState({}, '', '/contacts/ingest/microsoft');
  // Owner hook will refresh automatically, then useEffect will load preview
  // No need to manually reload - hook handles it
}
```

**Problem:**
- Comment says "hook will refresh automatically" but that's not guaranteed
- After OAuth callback, owner data needs to refresh to get new tokens
- The hook might not automatically refresh

**Fix:** Explicitly trigger owner refresh or wait for it

## Recommended Fixes

### Fix #1: Remove isConnected from dependencies

```javascript
// Compute isConnected inside effect, not as dependency
useEffect(() => {
  if (!ownerId || !owner) return;
  
  const isConnected = !!owner?.microsoftAccessToken;
  if (isConnected && !preview) {
    loadPreview();
  }
}, [ownerId, owner]); // Remove isConnected from deps
```

### Fix #2: Remove unused handleConnectMicrosoft function

```javascript
// DELETE lines 118-128 entirely
// Use direct redirect in both buttons
```

### Fix #3: Fix button handlers

```javascript
// Line 250 (Reconnect button)
onClick={() => {
  window.location.href = '/api/microsoft/login';
}}

// Line 268 (Connect button) - already correct
onClick={() => {
  window.location.href = '/api/microsoft/login';
}}
```

### Fix #4: Handle OAuth success properly

```javascript
if (success === '1') {
  window.history.replaceState({}, '', '/contacts/ingest/microsoft');
  // Force owner hook to refresh by triggering a re-render
  // Or wait for owner to update, then load preview
  // The owner hook should refresh automatically when tokens are saved
}
```

## Current useEffect Flow

1. **Line 26-34:** Load companyHQId from localStorage (runs once on mount)
2. **Line 37-61:** Handle OAuth callback URL params (runs once on mount)
3. **Line 97-108:** Load preview if connected (runs when ownerId/owner/isConnected change)

## Dependencies Analysis

| useEffect | Dependencies | Issues |
|-----------|-------------|--------|
| Line 26 | `[]` | ✅ OK |
| Line 37 | `[]` | ✅ OK |
| Line 97 | `[ownerId, owner, isConnected]` | ⚠️ isConnected changes on every owner update |

## State Variables

| Variable | Type | Used In |
|----------|------|---------|
| `companyHQId` | string | Save function |
| `loading` | boolean | UI loading states |
| `saving` | boolean | Save button state |
| `preview` | object | Preview display |
| `selectedPreviewIds` | Set | Selection state |
| `saveResult` | object | Success screen |
| `error` | string | Error display |
| `isConnected` | computed | Connection status check |

## Functions

| Function | Type | Used Where | Issues |
|----------|------|------------|--------|
| `loadPreview` | useCallback | useEffect, buttons | ✅ OK |
| `handleConnectMicrosoft` | function | Line 250 (Reconnect) | ❌ Unused, wrong |
| `toggleSelect` | function | Preview items | ✅ OK |
| `toggleSelectAll` | function | Select all button | ✅ OK |
| `handleSave` | async function | Save button | ✅ OK |
| `handleNext50` | async function | Next 50 button | ✅ OK |

## Button Handlers Audit

| Button | Line | Current Handler | Should Be |
|--------|------|----------------|------------|
| Reconnect | 250 | `handleConnectMicrosoft` | `window.location.href = '/api/microsoft/login'` |
| Connect | 268 | `window.location.href = '/api/microsoft/login'` | ✅ Correct |
| Refresh | 363 | `loadPreview` | ✅ OK |
| Save | 420 | `handleSave` | ✅ OK |

## Summary

**Main Issues:**
1. `isConnected` in useEffect dependencies causes re-renders
2. Unused `handleConnectMicrosoft` function with wrong logic
3. Reconnect button uses wrong handler

**Quick Fix:**
- Remove `isConnected` from dependencies
- Delete `handleConnectMicrosoft` function
- Use direct redirect in Reconnect button




