# WorkPackage Execution Architecture Analysis

## Current Problems

### 1. **N+1 Query Problem in Hydration Service**
**Location:** `src/lib/services/WorkPackageHydrationService.js`

**Problem:**
- Lines 47-128: For each item, loops through collateral and makes individual `prisma.findUnique()` calls
- If a WorkPackage has 10 items with 2 collateral each = **20 separate database queries**
- These queries are in a `for` loop, so they're **sequential, not parallel**

**Current Code:**
```javascript
const hydratedItems = await Promise.all(
  workPackage.items.map(async (item) => {
    const collateral = item.collateral || [];
    const artifacts = [];
    
    // ❌ PROBLEM: Sequential queries in a loop
    for (const coll of collateral) {
      switch (coll.collateralType) {
        case 'blog':
          artifact = await prisma.blog.findUnique({ where: { id: coll.collateralRefId } });
          break;
        case 'persona':
          artifact = await prisma.persona.findUnique({ where: { id: coll.collateralRefId } });
          break;
        // ... more individual queries
      }
    }
  })
);
```

**Impact:**
- Slow hydration (20+ queries per WorkPackage)
- Database connection pool exhaustion
- Poor scalability

---

### 2. **No Batch Fetching Strategy**
**Problem:**
- Should collect all collateral IDs by type first
- Then do ONE `findMany({ where: { id: { in: [ids] } } })` per artifact type
- This would be **5-6 queries total** instead of 20+

**Solution Pattern:**
```javascript
// 1. Collect all IDs by type
const blogIds = collateral.filter(c => c.collateralType === 'blog').map(c => c.collateralRefId);
const personaIds = collateral.filter(c => c.collateralType === 'persona').map(c => c.collateralRefId);
// ... etc

// 2. Batch fetch all at once
const [blogs, personas, templates, decks, pages] = await Promise.all([
  blogIds.length > 0 ? prisma.blog.findMany({ where: { id: { in: blogIds } } }) : [],
  personaIds.length > 0 ? prisma.persona.findMany({ where: { id: { in: personaIds } } }) : [],
  // ... etc
]);

// 3. Map back to items
```

---

### 3. **Data Redundancy Issues**

#### A. **Execution Hub List View**
**Location:** `src/app/(authenticated)/client-operations/execution/page.jsx`

**Current:**
- Calls `/api/workpackages?companyHQId=xxx`
- Returns minimal data (just fixed) but still includes nested `contact` objects
- Should return **only IDs** for list view

**Better:**
- Return: `{ id, title, description, contactId, companyId, _count: { phases, items } }`
- No nested objects
- Client can fetch contact details separately if needed

#### B. **WorkPackage Detail View**
**Location:** `src/app/api/workpackages/owner/[id]/hydrate/route.js`

**Current:**
- Fetches full WorkPackage with all phases, items, collateral
- Then hydration service makes 20+ individual queries
- Returns massive nested object

**Better:**
- Batch fetch all artifacts first
- Return minimal artifact data (id, title, status, published) - not full content
- Client can fetch full artifact details on-demand when clicking

---

### 4. **Company Filtering Issue**
**Location:** `src/app/api/workpackages/route.js`

**Problem:**
- Was filtering by `contactId` only
- Now fixed to filter by `companyHQId` through `contact.crmId`
- But this creates a join query that might be slow

**Better:**
- Consider adding `companyId` field directly to WorkPackage (if not already there)
- Or ensure proper indexing on `contact.crmId`

---

### 5. **Client Portal Dashboard "Engagement Being Prepared" Bug**
**Location:** `ignitebd-clientportal/app/dashboard/page.jsx` + `app/api/client/work/dashboard/route.js`

**Problem:**
- API returns `success: true` with `workPackage: null` when no work package found (line 86-99)
- Dashboard checks `!workPackage` and shows fallback message (line 226)
- But the lookup might be failing because:
  - WorkPackage lookup by `contactId` might not match
  - WorkPackage might be linked to `contactCompanyId` instead
  - Or work package exists but lookup is wrong

**Fix Needed:**
1. Check if work package lookup is correct (by contactId vs contactCompanyId)
2. Add better logging to see why lookup fails
3. Consider fallback to `contactCompanyId` lookup

---

## Proposed Architecture Changes

### 1. **Batch Artifact Fetching**
```javascript
// Collect all collateral IDs by type
const collateralByType = {
  blog: [],
  persona: [],
  template: [],
  deck: [],
  page: [],
};

workPackage.items.forEach(item => {
  item.collateral?.forEach(coll => {
    if (collateralByType[coll.collateralType]) {
      collateralByType[coll.collateralType].push(coll.collateralRefId);
    }
  });
});

// Batch fetch all artifacts in parallel
const [blogs, personas, templates, decks, pages] = await Promise.all([
  collateralByType.blog.length > 0 
    ? prisma.blog.findMany({ where: { id: { in: collateralByType.blog } } })
    : Promise.resolve([]),
  // ... etc
]);

// Create lookup map
const artifactMap = new Map();
blogs.forEach(b => artifactMap.set(`blog:${b.id}`, b));
personas.forEach(p => artifactMap.set(`persona:${p.id}`, p));
// ... etc

// Map back to items
const hydratedItems = workPackage.items.map(item => {
  const artifacts = item.collateral.map(coll => {
    const key = `${coll.collateralType}:${coll.collateralRefId}`;
    return artifactMap.get(key);
  }).filter(Boolean);
  
  return { ...item, artifacts };
});
```

**Benefits:**
- 5-6 queries instead of 20+
- All queries run in parallel
- Much faster

---

### 2. **Minimal Data Strategy**

#### List View (Execution Hub)
```javascript
// API returns only IDs
{
  id: "wp-123",
  title: "Q1 Campaign",
  contactId: "contact-456",
  companyId: "company-789",
  _count: { phases: 3, items: 12 }
}

// Client fetches contact details separately if needed
```

#### Detail View (WorkPackage Page)
```javascript
// API returns minimal artifact data
{
  id: "blog-123",
  title: "Blog Post Title",
  status: "published",
  published: true,
  // NO full content - fetch on demand
}
```

---

### 3. **Caching Strategy**
- Cache hydrated WorkPackage data in Redis/memory
- Invalidate on:
  - WorkPackageItem update
  - Collateral add/remove
  - Artifact status change
- TTL: 5 minutes

---

### 4. **Redundancy for Performance**
- Store computed fields in database:
  - `WorkPackagePhase.totalEstimatedHours` (already exists)
  - `WorkPackagePhase.expectedEndDate` (add to schema)
  - `WorkPackagePhase.timelineStatus` (add to schema)
  - `WorkPackageItem.progressCompleted` (add to schema)
- Update these fields via Prisma hooks or triggers
- Reduces computation on every load

---

## Implementation Priority

1. **HIGH:** Fix batch artifact fetching (N+1 problem)
2. **HIGH:** Fix client portal dashboard lookup bug
3. **MEDIUM:** Minimal data for list views
4. **MEDIUM:** Add computed fields to schema
5. **LOW:** Caching layer

---

## Questions to Answer

1. Should WorkPackage have direct `companyId` field, or always go through `contact.crmId`?
2. Should we store computed timeline/progress fields in DB or calculate on-the-fly?
3. What's the expected max number of items per WorkPackage? (affects batch size)
4. Should list views fetch contact details, or is ID enough?

