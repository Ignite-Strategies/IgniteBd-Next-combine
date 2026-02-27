# People Layer Refactor – Investigation

**Date:** Feb 2025  
**Issue:** "People" layer is causing collisions; bypass isn't working; `/contacts/view` isn't under `/people` but routes from it, so flow is "all jacked" and page can show perpetual "Loading...".

---

## Current State

### Route structure

| URL | Layout | Context / data |
|-----|--------|----------------|
| `/people`, `/people/load`, `/people/outreach-prep`, `/people/manage`, `/people/lists` | `people/layout.jsx` (passthrough) | **No** ContactsContext. Pages use `useSearchParams()`, localStorage, or own API calls. |
| `/contacts/view`, `/contacts/[contactId]`, `/contacts/upload`, etc. | `contacts/layout.jsx` | **ContactsContext** + **ContactListsContext**; `companyHQId` from URL; layout fetches contacts. |

So:

- **People** = hub + entry points (Load, Manage, Outreach Prep). No shared contact context.
- **Contacts** = actual contact UI (view list, detail, upload, lists). Has context and layout fetch.

### Why it’s “jacked”

1. **Flow vs URL**
   - User goes: People Hub → **Manage** → app redirects to **`/contacts/view`**.
   - So the main “view all contacts” screen lives under **`/contacts`**, not under **`/people`**. Sidebar has both “People” and “Contacts,” so it’s unclear that “Manage” leaves People and lands in Contacts.

2. **Duplicate fetch and loading**
   - **Contacts layout** fetches contacts when `companyHQId` is in the URL (for any `/contacts/*` route).
   - **`contacts/view`** does **not** use ContactsContext; it has its own state and its own `refreshContactsFromAPI()`. So we get:
     - Layout fetch (for context)
     - Page fetch (for view)
   - Result: two requests, two loading states. Layout can show “Loading…”, then the page shows “Loading Contacts…” until its own fetch finishes. If the page fetch fails or is slow, user can be stuck on “Loading…”.

3. **Bypass that “isn’t working”**
   - The “bypass” was: people layout no longer provides its own ContactsContext (so we don’t have two context trees). That part is in place (people layout is a passthrough).
   - What’s **not** fixed: `contacts/view` still doesn’t use the layout’s context. So we didn’t consolidate the **data layer**—we only removed context from people. People pages use ad‑hoc localStorage/API; contacts/view duplicates the layout’s fetch instead of using it.

4. **Collisions**
   - **People hub** page: own sync + localStorage for contacts.
   - **Contacts layout**: API-only fetch into React state (no localStorage for contacts).
   - **contacts/view**: own fetch + writes to localStorage again.
   - So contacts exist in both “people” localStorage and “contacts” context/view state → can diverge and feel “haunted” when switching routes.

---

## Why `/contacts/view?companyHQId=...` shows “Loading...”

1. **Layout:** `contacts/layout.jsx` wraps content in `<Suspense>` and uses `useSearchParams()` for `companyHQId`. Until search params are ready, the layout can show its fallback: “Loading...”.
2. **Page:** `contacts/view` wraps content in `<Suspense>` and uses `useSearchParams()`. So we can see the page fallback: “Loading Contacts…”.
3. **Page logic:** `ContactsViewPageContent` starts with `loading === true` and runs its **own** `useEffect` to call `refreshContactsFromAPI(true)`. So we see “Loading Contacts…” / “Fetching your contacts…” until that fetch completes.
4. If the API is slow or fails, or if there’s a hydration/redirect (e.g. no `companyHQId` for a moment), the page can stay on “Loading...” or redirect to `/people`.

So the “Loading...” you see is a mix of layout Suspense and the page’s own loading state + duplicate fetch.

---

## App shell and “one screen, then another, like 3 useEffects in one”

### What was happening

1. **Shell** – `AppShell` wraps the app and shows navbar + sidebar when `pathHasSidebar(resolvedPath)` (e.g. `/contacts/view`). The shell is always in the tree; the problem was the **main content area** swapping through several different UIs.

2. **Three “screens” in sequence**
   - **Screen 1:** Layout’s `<Suspense>` fallback (e.g. a bare “Loading...”) while `useSearchParams()` in the layout resolved. The whole main content was replaced by this.
   - **Screen 2:** Layout mounted, its **fetch** `useEffect` ran → `hydrating = true` → the **page** rendered with `loading = true` and showed a **full-screen** “Loading Contacts…” (different copy, different layout).
   - **Screen 3:** Fetch finished → real content.

   So it felt like “one screen and another” (and then a third) because we had two different loading UIs and a full-screen page loader that hid the fact the shell was there.

3. **“3 use effects in one”**
   - **Contacts layout** has three `useEffect`s on mount: (1) fetch contacts when `companyHQId` is set, (2) read contact lists from `localStorage`, (3) subscribe to `companyDataHydrated`. All run when you land on `/contacts/view`.
   - The **page** had its own fetch effect (now removed; it uses context).
   - So on load you had: layout suspend → layout mount → 3 layout effects + 1 page effect (redirect) → multiple re-renders and state updates → several visible “screens” in quick succession.

### What we changed

- **One loading phase:** Layout and page now share the **same** loading copy and layout: “Loading…” / “Getting your contacts” in a **content-area** block (not full-screen). So you get one consistent loading state instead of two or three different ones.
- **Shell always visible:** Loading UIs use `min-h-[calc(100vh-3.5rem)]` and live inside the main content area, so navbar and sidebar stay visible. No full-screen takeover.
- **Fewer effects driving “screens”:** The page no longer has its own fetch effect; it uses the layout’s context. So one fetch, one loading state, and the only “extra” effect on the page is the redirect when `companyHQId` is missing.

The app shell was always there; it’s now obvious because we don’t replace the whole view with a second full-screen loader, and the effect chain no longer produces three distinct-looking screens.

---

## Refactor options

### Option A – Quick fix (recommended first)

- **Make `contacts/view` use ContactsContext** from the layout.
  - Use `contacts` and `hydrated` / `hydrating` from context instead of local state and local fetch.
  - Remove the duplicate fetch and duplicate loading state from `contacts/view`.
- **Result:** One fetch (layout), one loading state. No double “Loading...”. Same URL and route structure.

### Option B – Unify under People (route restructure)

- Move “view all contacts” under `/people` so the flow stays inside “People”:
  - e.g. **`/people/view`** (or `/people/manage`) → same UI as current “All Contacts”, but route is under `/people`.
- People layout would need to provide contact data for `/people/view` (e.g. shared context or a provider that wraps both people and contacts).
- **Result:** “Manage” from People Hub keeps you on `/people/*`; sidebar “People” covers hub + view. Cleaner IA; more work (new route, possibly shared provider).

### Option C – Single provider above people + contacts

- Add a **ContactsContext** (and optionally ContactListsContext) provider **above** both `people` and `contacts` in the tree (e.g. in `(authenticated)` or a shared layout).
- Drive `companyHQId` from URL (or a global company selector) once, and have both `/people/*` and `/contacts/*` consume the same context.
- **Result:** One fetch, shared state when moving between People Hub and Contacts; no duplicate trees. Still two URL prefixes unless you also do Option B.

---

## Recommended order

1. **Do Option A** so `/contacts/view` is no longer “jacked” (one fetch, one loading state, use layout context).
2. **Then** decide:
   - If you want the “Manage” flow to stay under `/people`, do **Option B** (e.g. add `/people/view` and optionally redirect `/contacts/view` → `/people/view?companyHQId=...`).
   - If you’re fine with “Manage” going to `/contacts/view`, keep current URLs and optionally do **Option C** later so People Hub and Contacts share the same context and avoid duplicate fetches when switching.

---

## Files involved

- `app/(authenticated)/people/layout.jsx` – passthrough (no context).
- `app/(authenticated)/contacts/layout.jsx` – provides ContactsContext, ContactListsContext, fetches by `companyHQId`.
- `app/(authenticated)/contacts/view/page.jsx` – **currently** own state + own fetch; should use layout context (Option A).
- `app/(authenticated)/people/page.jsx` – People Hub; own sync + localStorage.
- `app/(authenticated)/people/manage/page.jsx` – redirects to `/contacts/view?companyHQId=...`.
- `docs/PEOPLE_AND_CONTACTS_ROUTE_ISSUES.md` – existing notes on redirects and two context trees.
