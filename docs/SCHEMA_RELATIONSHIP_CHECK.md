# Schema Relationship Check - Why company_hqs Might Be Null

## 🔍 Schema Definition

### bills Model
```prisma
model bills {
  companyId               String? // FK → company_hqs.id
  company_hqs             company_hqs?   @relation(fields: [companyId], references: [id], onDelete: Cascade)
}
```

### company_hqs Model
```prisma
model company_hqs {
  id                      String @id
  bills                   bills[]  // Reverse relation
}
```

## ✅ Schema Looks Correct

- `bills.companyId` → `company_hqs.id` ✅
- Relationship name: `company_hqs` ✅
- Foreign key: `companyId` ✅
- References: `company_hqs.id` ✅

## 🐛 Why Would `company_hqs` Be Null?

### Scenario 1: Company Record Doesn't Exist

**If `companyId = "24beffe1-..."` but that company_hqs record was deleted:**

```typescript
// Prisma query
const bill = await prisma.bills.findUnique({
  where: { slug },
  include: { company_hqs: { ... } }
});

// Result:
// bill.companyId = "24beffe1-..."  ✅ Set
// bill.company_hqs = null          ❌ NULL because record doesn't exist
```

**Check:**
```sql
SELECT * FROM company_hqs WHERE id = '24beffe1-6ada-4442-b90b-7e3ad8a2ec7d';
```

### Scenario 2: Prisma Include Not Working

**If Prisma's `include` fails silently:**

```typescript
include: {
  company_hqs: { 
    select: { 
      id: true,
      companyName: true,
      stripeCustomerId: true,
      // ... other fields
    } 
  },
}
```

**Possible issues:**
- Typo in relationship name
- Schema not regenerated after migration
- Prisma client not updated

### Scenario 3: companyId is NULL

**If `companyId` is actually null in database:**

```typescript
// Even though DB shows companyId, maybe it's actually null?
bill.companyId = null  // Would make company_hqs null
```

## 🔧 How To Debug

### Step 1: Verify Company Exists

```sql
-- Check if company exists
SELECT id, "companyName", "stripeCustomerId" 
FROM company_hqs 
WHERE id = '24beffe1-6ada-4442-b90b-7e3ad8a2ec7d';
```

**Expected:** Should return 1 row

**If 0 rows:** Company was deleted → That's the problem!

### Step 2: Verify Bill's companyId

```sql
-- Check bill's companyId
SELECT id, "companyId", slug 
FROM bills 
WHERE id = 'cmkzxj9km0000lc04kzjotdgn';
```

**Expected:** `companyId = '24beffe1-6ada-4442-b90b-7e3ad8a2ec7d'`

**If null:** Bill wasn't assigned properly

### Step 3: Test Prisma Query Directly

```typescript
// Test if relationship loads
const bill = await prisma.bills.findUnique({
  where: { id: 'cmkzxj9km0000lc04kzjotdgn' },
  include: {
    company_hqs: true,  // Just include, no select
  },
});

console.log('companyId:', bill?.companyId);
console.log('company_hqs:', bill?.company_hqs);
```

**Expected:** Both should be truthy

## 🎯 Most Likely Issue

**The company_hqs record with ID `24beffe1-6ada-4442-b90b-7e3ad8a2ec7d` doesn't exist in the database.**

**Why?**
- Company was deleted
- Migration issue
- Wrong ID stored

**Fix:**
1. Check if company exists: `SELECT * FROM company_hqs WHERE id = '24beffe1-...'`
2. If missing, either:
   - Re-create company
   - Re-assign bill to existing company
   - Fix the companyId reference

## 🔍 Quick Test

Run this query to see what's actually in the database:

```sql
SELECT 
  b.id as bill_id,
  b."companyId",
  b.slug,
  c.id as company_hqs_id,
  c."companyName",
  c."stripeCustomerId"
FROM bills b
LEFT JOIN company_hqs c ON b."companyId" = c.id
WHERE b.id = 'cmkzxj9km0000lc04kzjotdgn';
```

**Expected result:**
- `companyId` should match `company_hqs_id`
- `company_hqs_id` should NOT be null
- `companyName` should be "BusinessPoint Law"

**If `company_hqs_id` is null:** Company doesn't exist → That's why Prisma returns `null` for the relationship!
