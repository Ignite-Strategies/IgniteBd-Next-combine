# Microsoft Contacts Ingest Page - Button Analysis

**Page**: `/contacts/ingest/microsoft`  
**File**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`  
**Date**: January 2025

## Overview

This document details all buttons on the Microsoft contacts ingest page and their exact functionality.

---

## Button Inventory

### 1. Navigation Buttons

#### "Back to Contacts" Button
**Location**: Top of page, below header  
**Line**: 282-288  
**Icon**: `ArrowLeft`  
**Action**: 
```javascript
onClick={() => router.push('/contacts')}
```
- Navigates user back to `/contacts` page
- Uses Next.js router for client-side navigation
- Always visible

---

### 2. Microsoft Connection Section

#### "Connect Microsoft Account" Button
**Location**: Microsoft Account section (when NOT connected)  
**Line**: 336-345  
**Style**: Primary blue button (`bg-blue-600`)  
**Action**:
```javascript
onClick={() => {
  window.location.href = '/api/microsoft/login';
}}
```
- **Full page redirect** to `/api/microsoft/login`
- Initiates OAuth flow
- **Critical**: Uses `window.location.href` (not router) - required for OAuth
- Only visible when `isConnected === false`

**Flow**:
1. User clicks button
2. Browser navigates to `/api/microsoft/login`
3. Server generates OAuth state with `ownerId`
4. Redirects to Microsoft OAuth page
5. User authenticates
6. Microsoft redirects back to `/api/microsoft/callback`
7. Callback saves tokens and redirects back to this page with `?success=1`

#### "Reconnect" Button
**Location**: Microsoft Account section (when connected)  
**Line**: 309-323  
**Style**: Text link (`text-blue-600`)  
**Action**:
```javascript
onClick={() => {
  if (!ownerId) {
    alert('Please wait for authentication to complete.');
    return;
  }
  window.location.href = `/api/microsoft/login?ownerId=${ownerId}`;
}}
```
- **Full page redirect** to `/api/microsoft/login?ownerId={id}`
- Re-initiates OAuth flow (useful if tokens expired or user wants to switch accounts)
- Passes `ownerId` in URL so callback can save tokens
- Only visible when `isConnected === true`
- Shows alert if `ownerId` not available

---

### 3. Error Message Section Buttons

These buttons appear in the red error banner based on different error states:

#### "Go to Sign In" Button
**Location**: Error banner (when `LOGIN_REQUIRED`)  
**Line**: 362-367  
**Style**: Red button (`bg-red-600`)  
**Action**:
```javascript
onClick={() => router.push('/welcome')}
```
- Navigates to `/welcome` page
- Only shown when `uiState === UI_STATES.LOGIN_REQUIRED`
- Triggered when Firebase auth fails

#### "Reconnect Microsoft" Button
**Location**: Error banner (when `RECONNECT_MICROSOFT`)  
**Line**: 370-381  
**Style**: Blue button (`bg-blue-600`)  
**Action**:
```javascript
onClick={() => {
  if (!ownerId) {
    router.push('/welcome');
    return;
  }
  window.location.href = `/api/microsoft/login?ownerId=${ownerId}`;
}}
```
- Redirects to OAuth login with `ownerId`
- Falls back to `/welcome` if `ownerId` missing
- Only shown when `uiState === UI_STATES.RECONNECT_MICROSOFT`
- Triggered by OAuth callback errors

#### "Retry" Button
**Location**: Error banner (when `RETRY`)  
**Line**: 384-395  
**Style**: Gray button (`bg-gray-600`)  
**Action**:
```javascript
onClick={() => {
  setUiState(null);
  setErrorMessage(null);
  if (isConnected) {
    loadPreview();
  }
}}
```
- Clears error state
- Reloads preview if Microsoft is connected
- Only shown when `uiState === UI_STATES.RETRY`
- Triggered by API errors (preview load failures, save failures)

#### "X" Close Button
**Location**: Error banner (top right)  
**Line**: 399-407  
**Icon**: `X`  
**Action**:
```javascript
onClick={() => {
  setUiState(null);
  setErrorMessage(null);
}}
```
- Dismisses error message
- Clears both `uiState` and `errorMessage`
- Always visible when error banner is shown

---

### 4. Success Message Section Buttons

These buttons appear in the green success banner after saving contacts:

#### "Import Next 50" Button
**Location**: Success banner (after save)  
**Line**: 427-433  
**Icon**: `RefreshCw`  
**Style**: Green button (`bg-green-600`)  
**Action**:
```javascript
onClick={handleNext50}
```
**Function** (`handleNext50`, line 238-243):
```javascript
async function handleNext50() {
  setSaveResult(null);  // Clear success message
  await loadPreview();   // Reload preview (fetches next batch)
}
```
- Clears success message
- Reloads preview from API
- API fetches next 50 messages (skips already processed ones via Redis cache invalidation)
- Only visible when `saveResult` exists

**Note**: The API currently always fetches the same 50 most recent messages. To truly get "next 50", you'd need pagination logic.

#### "Done for Now" Button
**Location**: Success banner (after save)  
**Line**: 434-442  
**Style**: Gray button (`bg-gray-200`)  
**Action**:
```javascript
onClick={() => {
  setSaveResult(null);
  router.push('/contacts');
}}
```
- Clears success message
- Navigates to `/contacts` page
- Only visible when `saveResult` exists

---

### 5. Preview Section Buttons

#### "Select All" / "Deselect All" Button
**Location**: Preview section header (right side)  
**Line**: 468-473  
**Style**: Text link (`text-blue-600`)  
**Action**:
```javascript
onClick={toggleSelectAll}
```
**Function** (`toggleSelectAll`, line 174-182):
```javascript
function toggleSelectAll() {
  if (!preview || !preview.items) return;
  
  if (selectedPreviewIds.size === preview.items.length) {
    setSelectedPreviewIds(new Set());  // Deselect all
  } else {
    setSelectedPreviewIds(new Set(preview.items.map(item => item.previewId)));  // Select all
  }
}
```
- Toggles between selecting all contacts and deselecting all
- Text changes based on current selection state
- Only visible when preview has items

#### "Refresh" Button
**Location**: Preview section header (right side)  
**Line**: 475-482  
**Icon**: `RefreshCw` (spins when loading)  
**Style**: Gray button (`bg-gray-100`)  
**Action**:
```javascript
onClick={loadPreview}
disabled={loading}
```
**Function** (`loadPreview`, line 105-136):
```javascript
const loadPreview = useCallback(async () => {
  setLoading(true);
  setUiState(null);
  setErrorMessage(null);

  try {
    const response = await api.get('/api/microsoft/email-contacts/preview');
    
    if (response.data?.success) {
      setPreview(response.data);
      setSelectedPreviewIds(new Set());  // Reset selection
      setSaveResult(null);  // Clear previous save result
    } else {
      setUiState(UI_STATES.RETRY);
      setErrorMessage(response.data?.message || 'Failed to load preview');
    }
  } catch (err) {
    // Error handling...
  } finally {
    setLoading(false);
  }
}, []);
```
- Calls `GET /api/microsoft/email-contacts/preview`
- Fetches fresh preview data from Microsoft Graph API
- Clears selection and previous save results
- Disabled while `loading === true`
- Icon spins during loading

#### "Save Selected Contacts" Button
**Location**: Preview section footer (bottom right)  
**Line**: 532-548  
**Icon**: `Check` (or `RefreshCw` when saving)  
**Style**: Blue button (`bg-blue-600`), disabled when no selection  
**Action**:
```javascript
onClick={handleSave}
disabled={saving || selectedPreviewIds.size === 0 || !companyHQId}
```
**Function** (`handleSave`, line 185-235):
```javascript
async function handleSave() {
  // Validation
  if (!companyHQId) {
    setUiState(UI_STATES.RETRY);
    setErrorMessage('Company context required. Please navigate from a company.');
    return;
  }

  if (selectedPreviewIds.size === 0) {
    setUiState(UI_STATES.RETRY);
    setErrorMessage('Please select at least one contact to save');
    return;
  }

  setSaving(true);
  setUiState(null);
  setErrorMessage(null);

  try {
    const response = await api.post('/api/microsoft/email-contacts/save', {
      previewIds: Array.from(selectedPreviewIds),
      companyHQId,
    });

    if (response.data?.success) {
      setSaveResult({
        saved: response.data.saved,
        skipped: response.data.skipped,
        errors: response.data.errors,
      });
      setSelectedPreviewIds(new Set());  // Clear selection
    } else {
      setUiState(UI_STATES.RETRY);
      setErrorMessage(response.data?.message || 'Failed to save contacts');
    }
  } catch (err) {
    // Error handling...
  } finally {
    setSaving(false);
  }
}
```
- Validates `companyHQId` and selection
- Calls `POST /api/microsoft/email-contacts/save` with:
  - `previewIds`: Array of selected contact preview IDs
  - `companyHQId`: Company context from localStorage
- Saves selected contacts to database
- Shows success message with save statistics
- Disabled when:
  - `saving === true` (already saving)
  - `selectedPreviewIds.size === 0` (nothing selected)
  - `!companyHQId` (no company context)

#### "Refresh Preview" Button (Empty State)
**Location**: Preview section (when no contacts found)  
**Line**: 555-560  
**Style**: Text link (`text-blue-600`)  
**Action**:
```javascript
onClick={loadPreview}
```
- Same as "Refresh" button above
- Only visible when preview is empty (`preview.items.length === 0`)

---

### 6. Contact Item Selection

#### Contact Checkbox
**Location**: Each contact item in preview list  
**Line**: 502-508  
**Type**: HTML checkbox input  
**Action**:
```javascript
onChange={() => toggleSelect(item.previewId)}
onClick={(e) => e.stopPropagation()}  // Prevents row click
```
**Function** (`toggleSelect`, line 161-171):
```javascript
function toggleSelect(previewId) {
  setSelectedPreviewIds(prev => {
    const updated = new Set(prev);
    if (updated.has(previewId)) {
      updated.delete(previewId);  // Deselect
    } else {
      updated.add(previewId);  // Select
    }
    return updated;
  });
}
```
- Toggles individual contact selection
- Uses `Set` to track selected preview IDs
- Clicking checkbox also toggles selection (prevents double-toggle)

#### Contact Row Click
**Location**: Entire contact item row  
**Line**: 500  
**Action**:
```javascript
onClick={() => toggleSelect(item.previewId)}
```
- Clicking anywhere on the contact row toggles selection
- Checkbox click is stopped from propagating (prevents double-toggle)

---

## Button States & Visibility

### Conditional Visibility

| Button | Visible When |
|--------|-------------|
| "Connect Microsoft Account" | `isConnected === false` |
| "Reconnect" | `isConnected === true` |
| "Go to Sign In" | `uiState === LOGIN_REQUIRED` |
| "Reconnect Microsoft" | `uiState === RECONNECT_MICROSOFT` |
| "Retry" | `uiState === RETRY` |
| "X" Close | `uiState && errorMessage` |
| "Import Next 50" | `saveResult` exists |
| "Done for Now" | `saveResult` exists |
| "Select All" | `preview.items.length > 0` |
| "Refresh Preview" (empty) | `preview.items.length === 0` |

### Disabled States

| Button | Disabled When |
|--------|---------------|
| "Refresh" | `loading === true` |
| "Save Selected Contacts" | `saving === true` OR `selectedPreviewIds.size === 0` OR `!companyHQId` |

---

## API Endpoints Called

### GET `/api/microsoft/email-contacts/preview`
**Called by**: `loadPreview()` function  
**Triggers**: 
- "Refresh" button
- "Refresh Preview" button
- "Import Next 50" button
- Automatic on page load (if connected)

**Response**:
```javascript
{
  success: true,
  generatedAt: "ISO_TIMESTAMP",
  limit: 50,
  items: [
    {
      previewId: "hash",
      email: "user@example.com",
      displayName: "John Doe",
      domain: "example.com",
      stats: {
        firstSeenAt: "ISO_TIMESTAMP",
        lastSeenAt: "ISO_TIMESTAMP",
        messageCount: 5
      }
    }
  ]
}
```

### POST `/api/microsoft/email-contacts/save`
**Called by**: `handleSave()` function  
**Triggers**: "Save Selected Contacts" button

**Request Body**:
```javascript
{
  previewIds: ["hash1", "hash2", ...],
  companyHQId: "uuid"
}
```

**Response**:
```javascript
{
  success: true,
  saved: 10,
  skipped: 2,
  errors: []  // Optional
}
```

### GET `/api/microsoft/login`
**Called by**: Browser redirect (not API call)  
**Triggers**: 
- "Connect Microsoft Account" button
- "Reconnect" button
- "Reconnect Microsoft" button (error state)

**Note**: This is a server redirect, not an API call. The server generates OAuth URL and redirects browser to Microsoft.

---

## User Flow Examples

### Flow 1: First Time Connection
1. User lands on page → Sees "Connect Microsoft Account" button
2. Clicks "Connect Microsoft Account" → Redirects to OAuth
3. Authenticates with Microsoft → Redirects back with `?success=1`
4. Page detects success → Shows "Connected" status
5. Preview automatically loads → Shows contacts
6. User selects contacts → Clicks "Save Selected Contacts"
7. Success message appears → Shows "Import Next 50" and "Done for Now"

### Flow 2: Reconnection After Error
1. User has expired tokens → Sees error banner
2. Error banner shows "Reconnect Microsoft" button
3. Clicks "Reconnect Microsoft" → Redirects to OAuth
4. Re-authenticates → Tokens refreshed
5. Preview reloads automatically

### Flow 3: Manual Refresh
1. User wants fresh data → Clicks "Refresh" button
2. Button shows spinning icon → API call in progress
3. Preview reloads → Selection cleared
4. User selects new contacts → Saves

---

## Key Implementation Details

### OAuth Flow Requirements

**Critical**: OAuth buttons MUST use `window.location.href`, NOT:
- ❌ `router.push()` - Won't work for OAuth
- ❌ `api.get()` - Can't redirect browser
- ❌ `fetch()` - Can't redirect browser

**Why**: OAuth requires full page navigation to Microsoft's domain, then back to callback URL.

### State Management

- **Selection State**: `Set<string>` of preview IDs
- **Loading State**: Separate `loading` and `saving` states
- **Error State**: `uiState` enum + `errorMessage` string
- **Success State**: `saveResult` object with statistics

### Company Context

- `companyHQId` loaded from `localStorage` (`companyHQId` or `companyId`)
- Required for saving contacts
- If missing, "Save Selected Contacts" is disabled
- Error shown if user tries to save without company context

---

## Potential Issues & Improvements

### Issue 1: "Import Next 50" Doesn't Actually Skip
**Current**: Always fetches same 50 most recent messages  
**Fix Needed**: Implement pagination or skip logic in API

### Issue 2: No Loading State for OAuth Redirect
**Current**: Button click immediately redirects (no feedback)  
**Suggestion**: Show loading state before redirect

### Issue 3: Company Context Not Validated on Load
**Current**: Only checked when saving  
**Suggestion**: Show warning if `companyHQId` missing

### Issue 4: Selection Lost on Refresh
**Current**: Selection cleared when preview reloads  
**Suggestion**: Could preserve selection if same preview IDs exist

---

## Summary

The page has **13 distinct button actions** across 6 sections:

1. **Navigation**: Back to Contacts
2. **Connection**: Connect/Reconnect Microsoft
3. **Error Handling**: Go to Sign In, Reconnect, Retry, Close
4. **Success Actions**: Import Next 50, Done for Now
5. **Preview Controls**: Select All, Refresh
6. **Save Action**: Save Selected Contacts

All buttons follow React best practices with proper state management, error handling, and user feedback.

---

**Last Updated**: January 2025  
**File**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`

