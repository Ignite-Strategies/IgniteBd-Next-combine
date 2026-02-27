# /people and Contact Detail – What’s Going On

## Layout and context split

- **`/people` and everything under it** (`/people`, `/people/load`, `/people/manage`, etc.) use **`app/(authenticated)/people/layout.jsx`**. That layout provides **only `ContactsContext`** (contacts list, `companyHQId` from URL, refresh, etc.).
- **`/contacts/*`** (including `/contacts/view` and `/contacts/[contactId]`) use **`app/(authenticated)/contacts/layout.jsx`**. That layout provides **`ContactsContext` and `ContactListsContext`**.

So there are **two separate `ContactsContext` trees**:

- On `/people` → you’re in the **people** layout’s context (one state, one fetch).
- On `/contacts/view` or `/contacts/123` → you’re in the **contacts** layout’s context (different state, separate fetch).

State is **not** shared between People Hub and Contact list/Contact detail. Navigating from `/people` to `/contacts/view` or to a contact detail page tears down the people layout and mounts the contacts layout, so you get a new fetch and new state. That can feel “haunted” (re-fetches, brief empty state, etc.).

Contact detail (`/contacts/[contactId]`) **only** uses the **contacts** layout’s context. So anything wrong with “everything past /people” that also affects contact detail is likely one of the following.

---

## 1. Redirects from `/people/*` that drop `companyHQId`

Several routes under `/people` redirect to `/contacts/*` **without** preserving `companyHQId`:

| From | Redirect to | Bug |
|------|-------------|-----|
| `people/manage/page.jsx` | `router.replace('/contacts/view')` | No `companyHQId` in URL → contacts layout has empty `companyHQId`, won’t fetch. |
| `people/lists/page.jsx` | `router.replace('/contacts/list-manager')` | Same. |
| `people/outreach-prep/page.jsx` | `router.push('/contacts/list-builder')` or `list-manager` | Same. |

So if you land on e.g. `/people/manage` (or get there from People Hub without the card’s `companyHQId`-aware link), the redirect goes to `/contacts/view` with **no** `companyHQId`. The contacts layout then has no company context, so contact list (and anything that depends on it) can be empty or broken. Same idea for list-manager and list-builder. That can look like “contact detail (or list) is broken” when the real issue is missing company context on the contacts side.

**Fix:** For any redirect from `/people/*` to `/contacts/*`, preserve `companyHQId` (e.g. from `useSearchParams()` or `router`) and append it to the target URL (e.g. `/contacts/view?companyHQId=...`).

---

## 2. Layouts using `useSearchParams()` and Suspense

Both layouts drive `companyHQId` from the URL via **`useSearchParams()`**:

- **people/layout.jsx** – `companyHQId = searchParams?.get('companyHQId') || ''`.
- **contacts/layout.jsx** – same.

In the App Router, **`useSearchParams()` can suspend** until the client has the URL. Both layouts wrap their content in `<Suspense fallback={<div>Loading...</div>}>`. So when you navigate to any `/people/*` or `/contacts/*` route:

1. The layout’s inner content may suspend until `searchParams` are available.
2. You can see a brief “Loading…” from that layout.
3. Only then does the layout get `companyHQId` and run the fetch.

So “everything past /people” (and contact detail under `/contacts`) can feel janky: a flash of loading, then content. If there’s any hydration or transition quirk, `pathname` / `searchParams` can be wrong for a frame and you get the wrong context or empty state. That can affect contact detail too, since contact detail is under the **contacts** layout, which also uses `useSearchParams()` and the same Suspense pattern.

---

## 3. Sidebar visibility (AppShell)

Sidebar is shown when `pathHasSidebar(resolvedPath)` is true. `ROUTES_WITH_SIDEBAR` includes both `/people` and `/contacts`, so:

- `/people`, `/people/load`, `/people/manage`, etc. → sidebar.
- `/contacts/view`, `/contacts/[contactId]`, etc. → sidebar.

`resolvedPath` is set from `pathname` or `window.location.pathname` (for hydration). So in principle the sidebar should show for both areas. If it sometimes doesn’t, it’s likely a timing/hydration issue (e.g. `pathname` or `resolvedPath` wrong for one render) rather than the route list itself.

---

## 4. Summary table

| Issue | Affects | Fix |
|-------|--------|-----|
| Redirects from `/people/*` to `/contacts/*` without `companyHQId` | Contacts list, list-manager, list-builder, and any flow that expects company context (including contact detail if opened from there) | Append `companyHQId` to all such redirect URLs (from searchParams or router). |
| Two separate `ContactsContext` trees (people vs contacts) | Consistency when moving between People Hub and Contacts/contact detail; duplicate fetches | Optional: consider a single ContactsContext provider higher in the tree for both `/people` and `/contacts` so state and fetch are shared. |
| Layouts use `useSearchParams()` + Suspense | All routes under `/people` and `/contacts` (including contact detail); possible loading flash or wrong context on first paint | Optional: derive `companyHQId` in a way that doesn’t suspend (e.g. from a non-suspending source on first paint), or accept the brief loading and ensure redirects don’t drop `companyHQId`. |

---

## Recommended first step

**Preserve `companyHQId` on every redirect from `/people/*` to `/contacts/*`** (manage, lists, outreach-prep, and any other similar redirects). That way the contacts layout (and thus contact list and contact detail) always have company context when you come from People Hub, which should remove a big class of “contact detail / contacts broken” cases that are really “missing company context.”
