# Microsoft Integration - Front Door Audit

**Date:** 2025-01-27  
**Purpose:** Identify where users access Microsoft integration features

---

## 🚪 Entry Points Found

### 1. OAuth Connection (Settings → Integrations)
**Location:** `/settings/integrations`  
**File:** `app/(authenticated)/settings/integrations/page.jsx`

**Purpose:** Connect/disconnect Microsoft account (OAuth flow)

**Features:**
- "Connect Microsoft Account" button
- Shows connection status (connected/disconnected/expired)
- "Reauthorize" button if token expired
- "Disconnect" button
- Redirects to `/api/microsoft/login` to start OAuth

**Current Flow:**
1. User clicks "Connect Microsoft Account"
2. Redirects to `/api/microsoft/login`
3. OAuth callback at `/api/microsoft/callback`
4. Redirects back to `/settings/integrations?success=1`

**Status:** ✅ Functional - This is the OAuth connection front door

---

### 2. Contact Enrichment (Contacts Hub → Enrich → Microsoft)
**Location:** `/contacts/enrich/microsoft`  
**File:** `app/(authenticated)/contacts/enrich/microsoft/page.jsx`

**Purpose:** Fetch Microsoft contacts for enrichment

**Features:**
- "Fetch Microsoft Contacts" button
- Checks if Microsoft is connected (redirects to OAuth if not)
- Fetches contacts from `/api/microsoft-graph/contacts`
- Shows contact list with selection
- "Enrich Selected" button (currently shows "coming soon" alert)

**Current Flow:**
1. User navigates: Contacts Hub → "Enrich Contacts" → "Microsoft Email"
2. If not connected, redirects to `/api/microsoft/login`
3. Fetches contacts from Graph API
4. Displays contacts for selection
5. Enrichment is TODO (not implemented)

**Status:** ⚠️ Partially functional - Fetches contacts but enrichment not implemented

---

## 🗺️ Navigation Path

### Contacts Hub Entry
**Location:** `/contacts`  
**File:** `app/(authenticated)/contacts/page.jsx`

**Actions Available:**
- "Enrich Contacts" card → Routes to `/contacts/enrich`

**Enrich Hub Entry**
**Location:** `/contacts/enrich`  
**File:** `app/(authenticated)/contacts/enrich/page.jsx`

**Cards Available:**
1. "Lookup LinkedIn" → `/contacts/enrich/linkedin`
2. "Upload CSV" → `/contacts/enrich/csv`
3. **"Microsoft Email"** → `/contacts/enrich/microsoft` ⭐
4. "Existing CRM Contact" → `/contacts/enrich/existing`

---

## 🎯 For Contact Hydration

### Current State
- **OAuth Connection:** ✅ Exists at `/settings/integrations`
- **Contact Fetching:** ⚠️ Exists at `/contacts/enrich/microsoft` but:
  - Fetches `/api/microsoft-graph/contacts` (contacts endpoint)
  - Does NOT fetch messages (what we need for hydration)
  - Focused on enrichment, not hydration

### What's Missing for Contact Hydration
1. **No hydration-specific entry point** - Current entry is for enrichment
2. **Wrong API endpoint** - Uses `/api/microsoft-graph/contacts` instead of messages
3. **Wrong data source** - Fetches contacts, not inbox messages

---

## 💡 Options for Contact Hydration Front Door

### Option A: Add to Contacts Hub Directly
**Location:** `/contacts` (main hub page)

**Add new card:**
```javascript
{
  id: 'hydrate-microsoft',
  title: 'Hydrate from Outlook',
  description: 'Extract contact signals from your inbox',
  route: '/contacts/hydrate/microsoft',
  icon: Mail,
}
```

**Pros:**
- Direct access from contacts hub
- Clear separation from enrichment
- Matches "hydration" terminology

**Cons:**
- Adds another card to hub
- Need to create new route

---

### Option B: Add to Enrich Hub (Rename/Expand)
**Location:** `/contacts/enrich`

**Add new card:**
```javascript
{
  title: 'Hydrate from Outlook',
  desc: 'Extract contact signals from inbox messages',
  href: '/contacts/enrich/microsoft-hydrate',
}
```

**Pros:**
- Uses existing enrich hub structure
- Keeps Microsoft features together

**Cons:**
- Mixes "enrichment" and "hydration" concepts
- May confuse users

---

### Option C: Replace/Update Existing Microsoft Enrich Page
**Location:** `/contacts/enrich/microsoft`

**Modify existing page to:**
- Add tab or toggle: "Enrich Contacts" vs "Hydrate from Inbox"
- Or replace entirely with hydration focus

**Pros:**
- Reuses existing entry point
- No new navigation needed

**Cons:**
- Changes existing functionality
- May break existing enrichment flow

---

### Option D: Add to Settings → Integrations
**Location:** `/settings/integrations`

**Add "Hydrate Contacts" button next to connection status**

**Pros:**
- Keeps Microsoft features in one place
- User already connects there

**Cons:**
- Settings page is for configuration, not actions
- Less discoverable

---

## 📋 Recommendation

**Option A: Add to Contacts Hub**

**Rationale:**
1. **Clear separation** - Hydration is different from enrichment
2. **Discoverable** - Users looking for contacts will see it
3. **Matches architecture** - Hydration is a contact management feature
4. **Doesn't break existing** - Leaves enrichment flow intact

**Implementation:**
- Add new card to `CORE_ACTIONS` in `/contacts/page.jsx`
- Create new route: `/contacts/hydrate/microsoft`
- New page calls `/api/microsoft/contacts/preview` (to be created)
- Shows ContactCandidate list (preview only, no persistence)

---

## 🔄 Current vs Desired Flow

### Current Flow (Enrichment)
```
Contacts Hub → Enrich Contacts → Microsoft Email
  ↓
Check connection → Fetch contacts → Select → Enrich (TODO)
```

### Desired Flow (Hydration)
```
Contacts Hub → Hydrate from Outlook
  ↓
Check connection → Fetch messages → Show ContactCandidate preview
```

**Key Difference:**
- **Enrichment:** Fetches contacts, selects, enriches existing CRM contacts
- **Hydration:** Fetches messages, extracts signals, shows preview (no persistence)

---

## ✅ Summary

**Front Door Locations:**
1. ✅ **OAuth Connection:** `/settings/integrations` - Functional
2. ⚠️ **Contact Enrichment:** `/contacts/enrich/microsoft` - Functional but wrong for hydration
3. ❌ **Contact Hydration:** Does not exist yet

**Recommendation:**
- Add "Hydrate from Outlook" card to Contacts Hub (`/contacts`)
- Create new route: `/contacts/hydrate/microsoft`
- Keep existing enrichment flow separate

