# AppShell Routes Audit

## Issue
App shell (Navigation, CompanyHQContextHeader, Sidebar) not showing on some pages, particularly `/contacts/view` and other contact routes.

## Root Cause Analysis

### 1. Missing Routes in ROUTES_WITH_SIDEBAR
**Problem**: `/contacts` was not included in `ROUTES_WITH_SIDEBAR`, so the sidebar wouldn't show on contact pages.

**Fix**: Added `/contacts` to `ROUTES_WITH_SIDEBAR` array.

### 2. Firebase Auth Check Timing
**Problem**: The `isAuthenticated` state starts as `false` and only updates after Firebase auth check completes. This causes a flash where the app shell doesn't render until auth is confirmed.

**Fix**: Added `authChecked` state to track when auth check is complete. Use optimistic rendering - show shell by default unless explicitly unauthenticated after check.

### 3. Route Configuration

**Current ROUTES_WITH_SIDEBAR:**
```javascript
const ROUTES_WITH_SIDEBAR = [
  '/growth-dashboard',
  '/people',
  '/personas',
  '/persona',
  '/products',
  '/product',
  '/outreach',
  '/pipelines',
  '/proposals',
  '/content',
  '/branding-hub',
  '/events',
  '/meetings',
  '/insights',
  '/bd-intelligence',
  '/settings',
  '/client-operations',
  '/workpackages',
  '/client-operations/execution',
  '/billing',
  '/templates',
  '/people', // Duplicate
  '/companies',
  '/contacts', // ✅ ADDED
];
```

**Routes that should show sidebar but might be missing:**
- `/contacts` ✅ (now added)
- `/contacts/view` ✅ (covered by `/contacts`)
- `/contacts/[contactId]` ✅ (covered by `/contacts`)
- `/contacts/enrich/*` ✅ (covered by `/contacts`)

## AppShell Rendering Logic

### Components Always Shown (when authenticated):
1. **Navigation** - Top navigation bar (Growth Dashboard, Settings links)
2. **CompanyHQContextHeader** - Company context and switch dropdown

### Components Conditionally Shown:
1. **Sidebar** - Only when route matches `ROUTES_WITH_SIDEBAR`

### Rendering Decision:
```javascript
const shouldShowShell = !isPublicRoute && (!authChecked || isAuthenticated);
```

**Logic:**
- Show shell if NOT a public route AND:
  - Auth hasn't been checked yet (optimistic render), OR
  - Auth has been checked and user IS authenticated

**Why optimistic render?**
- Prevents flash of content without navigation
- Firebase auth check is async and can take time
- Better UX - assume authenticated until proven otherwise

## Testing Checklist

### Pages to Test:
- [ ] `/contacts/view` - Should show Navigation, ContextHeader, Sidebar
- [ ] `/contacts/[contactId]` - Should show Navigation, ContextHeader, Sidebar
- [ ] `/contacts/enrich/linkedin` - Should show Navigation, ContextHeader, Sidebar
- [ ] `/contacts/manual` - Should show Navigation, ContextHeader, Sidebar
- [ ] `/growth-dashboard` - Should show all (baseline)
- [ ] `/people` - Should show all (baseline)
- [ ] `/signin` - Should NOT show shell (public route)
- [ ] `/welcome` - Should NOT show ContextHeader (HIDE_CONTEXT_ROUTES)

### What to Verify:
1. **Navigation bar** appears at top
2. **CompanyHQContextHeader** appears below navigation
3. **Sidebar** appears on left (for routes in ROUTES_WITH_SIDEBAR)
4. **Main content** has proper margin when sidebar is shown (`ml-64`)
5. **No flash** of content without navigation on page load

## Related Files

- `components/AppShell.jsx` - Main shell component
- `components/Navigation.jsx` - Top navigation bar
- `components/CompanyHQContextHeader.jsx` - Company context header
- `components/Sidebar.jsx` - Left sidebar navigation

## Future Improvements

1. **Consolidate route lists** - Consider a single source of truth for route configuration
2. **Add route groups** - Group routes by feature area for easier management
3. **User preferences** - Allow users to toggle sidebar visibility
4. **Route-based layouts** - Consider Next.js layout files for route-specific layouts

