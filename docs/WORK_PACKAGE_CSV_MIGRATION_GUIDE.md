# Work Package CSV Import - Migration Guide

## 🚀 Quick Start

### Step 1: Run Prisma Migration

```bash
# Generate and apply migration
npx prisma migrate dev --name "add_workpackage_csv_import_fields"

# Regenerate Prisma Client
npx prisma generate
```

### Step 2: Test the Import

Use the provided CSV data or the template to test the one-shot import:

```bash
curl -X POST http://localhost:3000/api/workpackages/import/one-shot \
  -F "file=@workpackage.csv" \
  -F "contactId=contact-123" \
  -F "companyId=company-456" \
  -F "title=Starter Build-Out"
```

---

## 📋 Migration Details

### Schema Changes

#### WorkPackage Table
```sql
ALTER TABLE work_packages
  ADD COLUMN title TEXT NOT NULL DEFAULT '',
  ADD COLUMN description TEXT,
  ADD COLUMN total_cost DOUBLE PRECISION,
  ADD COLUMN effective_start_date TIMESTAMP;

-- Update existing rows (if any)
UPDATE work_packages SET title = 'Untitled Work Package' WHERE title = '';

-- Add index
CREATE INDEX work_packages_company_id_idx ON work_packages(company_id);
```

#### WorkPackagePhase Table
```sql
ALTER TABLE work_package_phases
  ADD COLUMN description TEXT,
  ADD COLUMN total_estimated_hours INTEGER,
  ALTER COLUMN phase_total_duration DROP NOT NULL;

-- Add unique constraint for idempotent upsert
CREATE UNIQUE INDEX work_package_phases_unique_idx 
  ON work_package_phases(work_package_id, name, position);
```

#### WorkPackageItem Table
```sql
ALTER TABLE work_package_items
  ADD COLUMN deliverable_type TEXT NOT NULL DEFAULT '',
  ADD COLUMN deliverable_label TEXT NOT NULL DEFAULT '',
  ADD COLUMN deliverable_description TEXT,
  ADD COLUMN estimated_hours_each INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN duration DROP NOT NULL,
  ALTER COLUMN status SET DEFAULT 'not_started';

-- Sync legacy fields to new fields (one-time migration)
UPDATE work_package_items 
SET 
  deliverable_type = item_type,
  deliverable_label = item_label,
  deliverable_description = item_description,
  estimated_hours_each = COALESCE(duration, 0)
WHERE deliverable_type = '' OR deliverable_label = '';

-- Add unique constraint for idempotent upsert
CREATE UNIQUE INDEX work_package_items_unique_idx 
  ON work_package_items(work_package_id, work_package_phase_id, deliverable_label);

-- Add index for deliverable_type
CREATE INDEX work_package_items_deliverable_type_idx 
  ON work_package_items(deliverable_type);
```

---

## 🔄 Data Migration Script (Optional)

If you have existing data, run this to sync legacy fields:

```javascript
// scripts/migrate-workpackage-legacy-fields.js
const { prisma } = require('../src/lib/prisma');

async function migrateLegacyFields() {
  const items = await prisma.workPackageItem.findMany({
    where: {
      OR: [
        { deliverableType: '' },
        { deliverableLabel: '' },
        { estimatedHoursEach: 0 },
      ],
    },
  });

  for (const item of items) {
    await prisma.workPackageItem.update({
      where: { id: item.id },
      data: {
        deliverableType: item.itemType || item.deliverableType || 'UNKNOWN',
        deliverableLabel: item.itemLabel || item.deliverableLabel || 'Unnamed Item',
        deliverableDescription: item.itemDescription || item.deliverableDescription,
        estimatedHoursEach: item.estimatedHoursEach || item.duration || 0,
      },
    });
  }

  console.log(`✅ Migrated ${items.length} items`);
}

migrateLegacyFields()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## ✅ Verification Checklist

After migration:

- [ ] Run `npx prisma generate` - no errors
- [ ] Check database - new columns exist
- [ ] Test one-shot CSV import - works
- [ ] Test modular import (3-step) - works
- [ ] Verify idempotent upsert - re-upload doesn't duplicate
- [ ] Check computed hours - `totalEstimatedHours` calculated correctly
- [ ] Verify legacy field sync - `itemType` → `deliverableType` works

---

## 🐛 Troubleshooting

### Issue: "Column does not exist"
**Solution**: Run migration again or check Prisma schema matches database

### Issue: "Unique constraint violation"
**Solution**: This is expected for idempotent upsert - it means the item already exists and will be updated

### Issue: "TypeScript import errors"
**Solution**: Next.js should handle TypeScript imports automatically. If not, ensure `tsconfig.json` is configured correctly.

### Issue: "Missing required fields"
**Solution**: Check CSV format matches template exactly. All required columns must be present.

---

## 📝 Next Steps After Migration

1. **Test with provided CSV** - Use the 17-row CSV from user's request
2. **Build Frontend UI** - Create CSV upload page similar to proposal CSV upload
3. **Add Validation** - Frontend validation before upload
4. **Add Preview** - Show preview before import (like proposal CSV)
5. **Handle Errors** - Display validation errors clearly

---

## 🔗 Related Files

- `prisma/schema.prisma` - Updated models
- `src/lib/utils/csv.ts` - CSV parser
- `src/lib/services/workpackageHydrationService.ts` - Hydration logic
- `src/app/api/workpackages/import/one-shot/route.js` - One-shot API
- `src/app/api/workpackages/import/proposal/route.js` - Step 1 API
- `src/app/api/workpackages/import/phases/route.js` - Step 2 API
- `src/app/api/workpackages/import/items/route.js` - Step 3 API
- `docs/WORK_PACKAGE_CSV_TEMPLATE.md` - CSV template guide

