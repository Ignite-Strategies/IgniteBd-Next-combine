# WEDNESDAY FIX LIST — Planning Summary

## ✅ Planning Complete

This document summarizes the planning work completed for Wednesday's multi-tenant cleanup fixes.

---

## Files Created

### Planning Documents
1. **`docs/WEDNESDAY_FIX_LIST_PLANNING.md`** - Comprehensive planning document with:
   - Detailed problem statements
   - File paths to modify
   - Code blocks to change
   - Implementation notes
   - Testing checklists
   - Risk assessments

2. **`docs/WEDNESDAY_FIX_LIST_SUMMARY.md`** (this file) - Quick reference summary

---

## Files Modified with TODO Comments

### Fix #1: Tenant Switch Hydration Gateway
- ✅ `src/lib/tenant.js` - Added TODO comments for redirect change
- ✅ `src/lib/tenantSwitch.js` - Added TODO comments for redirect change
- ✅ `src/stores/ownerStore.js` - Added TODO comment for store reset
- ✅ `src/hooks/useCompanyHydration.js` - Added TODO comment for cache clearing

### Fix #2: Product Hydration Fix
- ✅ `src/app/(authenticated)/products/page.jsx` - Added tenant scoping TODO
- ✅ `src/app/(authenticated)/products/builder/page.jsx` - Added creation/edit TODO
- ✅ `src/app/api/products/route.js` - Added scoping validation TODO

### Fix #3: Persona Hydration Fix
- ✅ `src/app/(authenticated)/personas/page.jsx` - Added tenant scoping TODO
- ✅ `src/app/(authenticated)/persona/page.jsx` - Added env var replacement TODO
- ✅ `src/app/api/personas/route.js` - Added scoping validation TODO

### Fix #4: BD Goal Refactor Stub
- ✅ `src/app/(authenticated)/growth-dashboard/page.jsx` - Added comprehensive TODO comments with implementation outline
- ✅ `prisma/schema.prisma` - Added commented-out schema fields for future migration

### Fix #5: Navigation Banner (Optional)
- ✅ Documented in planning doc only (no code changes)

---

## Implementation Checklist for Wednesday

### Fix #1: Tenant Hydration Gateway
- [ ] Create `src/app/(authenticated)/tenant-hydrate/page.jsx`
- [ ] Implement localStorage clearing logic
- [ ] Implement store reset logic
- [ ] Implement owner hydration API call
- [ ] Implement company hydration API call
- [ ] Update `switchTenant()` redirect in both tenant.js files
- [ ] Test tenant switching flow

### Fix #2: Product Hydration Fix
- [ ] Review all product API routes (already have companyHQId support)
- [ ] Verify all queries use `companyHQId` consistently
- [ ] Add validation to require `companyHQId`
- [ ] Test product creation/editing
- [ ] Test cross-tenant isolation

### Fix #3: Persona Hydration Fix
- [ ] Review all persona API routes (already have companyHQId support)
- [ ] Replace env var patterns with localStorage reading
- [ ] Verify all queries use `companyHQId` consistently
- [ ] Add validation to require `companyHQId`
- [ ] Test persona creation/editing
- [ ] Test cross-tenant isolation

### Fix #4: BD Goal Refactor Stub
- [x] ✅ Add TODO comments (done)
- [x] ✅ Document schema migration outline (done)
- [ ] **DO NOT** implement full feature (Thursday)

### Fix #5: Navigation Banner
- [x] ✅ Document requirements (done)
- [ ] **DO NOT** implement UI (future enhancement)

---

## Key Implementation Notes

### Tenant Hydration Gateway Route
The new `/tenant-hydrate` route must:
1. Read `companyHQId` from localStorage
2. Clear tenant-scoped localStorage keys (preserve auth)
3. Reset tenant-scoped stores
4. Call `GET /api/owner/hydrate`
5. Call `GET /api/company/hydrate?companyHQId=${companyHQId}`
6. Redirect to `/growth-dashboard`

### localStorage Keys to Clear
Clear these tenant-scoped keys:
- `owner`, `companyHQ`, `companyHydration_*`
- `personas`, `personaId`, `contacts`, `products`
- `pipelines`, `proposals`, `phaseTemplates`
- `deliverableTemplates`, `workPackages`, `contactLists`, `outreachCampaigns`

Preserve these auth keys:
- `firebaseToken`, `firebaseId`, `companyHQId` (new one)

### Schema Migration for BD Goal (Thursday)
Add these fields to `CompanyHQ` model:
```prisma
bdGoal      Float?    // Target BD revenue goal
bdGoalStart DateTime? // Goal period start date
bdGoalEnd   DateTime? // Goal period end date
```

---

## Testing Priorities

1. **Tenant Switching** - Critical path, test thoroughly
2. **Cross-Tenant Isolation** - Verify products and personas don't leak
3. **Hydration Flow** - Ensure all data loads correctly after switch
4. **Backward Compatibility** - Ensure existing functionality still works

---

## Risk Mitigation

- Keep backup of current `switchTenant()` implementation
- Test tenant switching with multiple tenants
- Verify no data leaks between tenants
- Rollback plan: Revert redirect change if hydration gateway fails

---

## Next Steps

1. Review planning document: `docs/WEDNESDAY_FIX_LIST_PLANNING.md`
2. Implement fixes on Wednesday following the checklist
3. Test thoroughly before deployment
4. Implement BD Goal feature on Thursday (Fix #4)

---

**Planning Status**: ✅ Complete  
**Ready for Implementation**: ✅ Yes  
**Implementation Date**: Wednesday

