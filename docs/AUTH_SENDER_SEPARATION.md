# Auth State and Sender Verification Separation

## Problem

The compose page was mixing concerns:
1. **Auth state** - Authentication status
2. **Sender verification** - SendGrid verified sender status
3. **Duplicate logic** - Both compose page and SenderIdentityPanel were loading sender status

This caused issues when:
- Auth state changed (user logged out/in)
- Sender verification status changed
- Errors weren't properly handled based on auth vs sender issues

## Solution: Separation of Concerns

### 1. **SenderIdentityPanel** - Single Source of Truth for Sender State

**Responsibilities:**
- ✅ Loads sender status from API
- ✅ Handles sender selection/change
- ✅ Manages sender state internally
- ✅ Handles auth state changes (resets when `ownerId` becomes null)
- ✅ Notifies parent via callback when sender state changes

**What it does NOT do:**
- ❌ Doesn't handle form submission
- ❌ Doesn't handle email sending
- ❌ Doesn't duplicate sender loading logic

### 2. **Compose Page** - Email Composition Only

**Responsibilities:**
- ✅ Manages email form state (to, subject, body)
- ✅ Handles contact selection
- ✅ Handles email sending
- ✅ Validates form before sending
- ✅ Tracks if sender is verified (via callback from SenderIdentityPanel)

**What it does NOT do:**
- ❌ Doesn't load sender status (delegates to SenderIdentityPanel)
- ❌ Doesn't manage sender state (delegates to SenderIdentityPanel)
- ❌ Doesn't duplicate sender verification logic

### 3. **Auth State Handling**

**In SenderIdentityPanel:**
```javascript
useEffect(() => {
  if (!ownerId) {
    // Auth state changed - reset sender state
    setSenderEmail(null);
    setSenderName(null);
    if (onSenderChange) {
      onSenderChange(false);
    }
    return;
  }
  // Load sender when authenticated
  loadSenderStatus();
}, [ownerId]);
```

**In Compose Page:**
```javascript
useEffect(() => {
  if (!ownerId) {
    // Auth state changed - reset UI state
    setHasVerifiedSender(false);
    setError(null);
    setSuccess(false);
  }
}, [ownerId]);
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Compose Page                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Form State (to, subject, body)                  │   │
│  │  Contact Selection                               │   │
│  │  Email Sending                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│                         │ callback: onSenderChange      │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │     SenderIdentityPanel                         │   │
│  │  • Loads sender from API                        │   │
│  │  • Handles sender selection                     │   │
│  │  • Manages sender state                         │   │
│  │  • Handles auth state changes                   │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│                         │ API calls                      │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  /api/outreach/verified-senders                 │   │
│  │  • GET - Get verified sender                    │   │
│  │  • PUT - Set verified sender                    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Key Changes

### Before (Mixed Concerns)
```javascript
// Compose page was doing:
- Loading sender status ✅ (duplicate)
- Managing sender state ✅ (duplicate)
- Handling auth state ❌ (not handled)
- Sending emails ✅
```

### After (Separated Concerns)
```javascript
// Compose page:
- Tracks sender state via callback ✅
- Handles auth state changes ✅
- Sends emails ✅

// SenderIdentityPanel:
- Loads sender status ✅ (single source)
- Manages sender state ✅ (single source)
- Handles auth state changes ✅
- Notifies parent via callback ✅
```

## Error Handling

### Auth Errors (401)
- **Compose Page**: Shows "Your session has expired" message
- **SenderIdentityPanel**: Clears sender state, shows loading state

### Sender Verification Errors
- **Compose Page**: Shows sender verification error, disables send button
- **SenderIdentityPanel**: Shows error in panel, allows user to fix

### SendGrid Errors
- **Compose Page**: Shows specific error (credits, verification, etc.)
- **SenderIdentityPanel**: Not affected (only manages sender selection)

## Benefits

1. **Single Source of Truth**: Sender state only managed in SenderIdentityPanel
2. **Proper Auth Handling**: Both components handle auth state changes
3. **No Duplication**: Sender loading logic only in one place
4. **Clear Separation**: Each component has clear responsibilities
5. **Better Error Handling**: Auth errors vs sender errors handled separately
6. **Easier Testing**: Each component can be tested independently

## Testing

### Test Auth State Changes
1. User logs in → SenderIdentityPanel loads sender
2. User logs out → Both components reset state
3. Token expires → Components handle 401 errors gracefully

### Test Sender State Changes
1. User selects sender → SenderIdentityPanel updates, notifies compose page
2. Sender removed in SendGrid → Components handle gracefully
3. Sender verification fails → Clear error messages shown

## Related Files

- `app/(authenticated)/outreach/compose/page.jsx` - Compose page
- `components/SenderIdentityPanel.jsx` - Sender management component
- `app/api/outreach/verified-senders/route.js` - API endpoint
- `hooks/useOwner.js` - Owner/auth hook

