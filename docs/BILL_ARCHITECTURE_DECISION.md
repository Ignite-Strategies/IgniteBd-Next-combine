# Bill Subdomain Architecture Decision

## Decision: Single Repo, Multiple Subdomains

**Status**: ✅ **WISE** - This is a best practice architecture

## Current Setup

- **Main App**: `app.ignitegrowth.biz` (IgniteBd-Next-combine repo)
- **Bills Subdomain**: `bills.ignitegrowth.biz` (same repo, different domain)
- **Platform Manager**: Separate repo (`Ignite-platform-manager`)

## Why This Architecture Works

### ✅ Advantages

1. **Code Reuse**
   - Same Prisma schema and database
   - Shared components (`BillContainer`, `BillForm`)
   - Consistent business logic
   - Single source of truth for bill data

2. **Operational Efficiency**
   - One deployment pipeline
   - One build process
   - Shared infrastructure (database, API routes)
   - Easier debugging (same codebase, same logs)

3. **Cost Effective**
   - No duplicate hosting costs
   - No separate CI/CD setup
   - Shared Vercel project (just add domain)

4. **Next.js Optimizations**
   - Route groups (`(public)` vs `(authenticated)`) separate concerns
   - Automatic code splitting (only loads needed code)
   - Server Components for bill pages (minimal JS)
   - `AppShell` exclusion prevents admin UI on bill routes

5. **Maintainability**
   - Fix bugs once, works everywhere
   - Update bill logic in one place
   - Consistent branding and UX
   - Easier onboarding for new developers

### ⚠️ Potential Concerns (and why they don't apply)

1. **"Coupling Risk"**
   - ✅ Mitigated: Bill routes are isolated via route groups
   - ✅ Mitigated: `AppShell` excludes bill routes from admin UI
   - ✅ Mitigated: Server Components mean minimal shared JS

2. **"Deployment Risk"**
   - ✅ Mitigated: Next.js route isolation
   - ✅ Mitigated: Bill pages are simple, low-risk
   - ✅ Mitigated: Can use Vercel preview deployments for testing

3. **"Scaling Concerns"**
   - ✅ Not needed: Payment pages are lightweight
   - ✅ Vercel handles scaling automatically
   - ✅ If needed later, can extract without major refactor

## Comparison: Single Repo vs Separate Repos

| Aspect | Single Repo (Current) | Separate Repos |
|--------|----------------------|----------------|
| **Code Reuse** | ✅ Full reuse | ❌ Duplicate code |
| **Maintenance** | ✅ One place | ❌ Multiple places |
| **Deployment** | ✅ One pipeline | ❌ Multiple pipelines |
| **Cost** | ✅ Lower | ❌ Higher |
| **Consistency** | ✅ Guaranteed | ⚠️ Must maintain |
| **Isolation** | ✅ Route groups | ✅ Complete isolation |
| **Complexity** | ✅ Lower | ❌ Higher |

## Industry Examples

This pattern is used by:
- **Vercel**: `vercel.com` + `vercel.app` (same codebase)
- **GitHub**: `github.com` + `gist.github.com` (shared infrastructure)
- **Stripe**: `stripe.com` + `checkout.stripe.com` (same repo, different routes)
- **Linear**: `linear.app` + `linear.app/issue/...` (route-based separation)

## When to Consider Separate Repos

Only if:
1. **Different tech stacks** (e.g., bills need Python, main app is Next.js)
2. **Different teams** with conflicting deployment schedules
3. **Different scaling needs** (bills need dedicated infrastructure)
4. **Regulatory requirements** (bills must be completely isolated)

**None of these apply to your use case.**

## Recommendation

✅ **Keep the current architecture** - It's well-designed and follows industry best practices.

### Optional Optimizations

1. **URL Structure**: Use rewrites in `next.config.mjs` to make bills URLs cleaner:
   ```
   bills.ignitegrowth.biz/company-slug/bill-id
   ```
   Instead of:
   ```
   bills.ignitegrowth.biz/bill/company-slug/bill-id
   ```

2. **Environment Variable**: Use `BILLS_DOMAIN` env var for flexibility:
   ```typescript
   const BILLS_DOMAIN = process.env.BILLS_DOMAIN || 'app.ignitegrowth.biz';
   ```

3. **Monitoring**: Add separate analytics for bills subdomain to track payment page performance independently.

## Conclusion

**This architecture is WISE, not wasteful.** It follows Next.js best practices, reduces maintenance burden, and provides clean separation through route groups. The subdomain provides better UX and branding without the overhead of separate infrastructure.
