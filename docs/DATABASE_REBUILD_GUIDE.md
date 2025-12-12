# Database Rebuild Guide - After Render DB Deletion

**Date:** 2025-01-28  
**Status:** 🔴 CRITICAL - Database Rebuild Required

---

## 🚨 Situation

Database on Render was deleted. Need to:
1. Create new database
2. Run all migrations
3. Set up initial Owner record
4. Verify everything works

---

## 📋 Step-by-Step Rebuild

### Step 1: Create New Database

#### Option A: Render (Recommended for Production)
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name:** `ignitedb` (or your preferred name)
   - **Database:** `ignitedb`
   - **User:** `ignitedb_user`
   - **Region:** Choose closest to your app
4. Click **"Create Database"**
5. Wait for provisioning (~2 minutes)
6. Copy the **Internal Database URL** (for server-side)
7. Copy the **External Database URL** (for local dev)

#### Option B: Local PostgreSQL (For Development)
```bash
# Install PostgreSQL (if not installed)
brew install postgresql@15  # macOS
# or
sudo apt-get install postgresql  # Linux

# Start PostgreSQL
brew services start postgresql@15

# Create database
createdb ignitedb

# Get connection string
echo "postgresql://$(whoami):@localhost:5432/ignitedb"
```

#### Option C: Supabase (Free Tier Available)
1. Go to [Supabase](https://supabase.com)
2. Create new project
3. Get connection string from Settings → Database

---

### Step 2: Update Environment Variables

**Local Development (.env.local):**
```bash
DATABASE_URL="postgresql://user:password@host:5432/ignitedb?sslmode=require"
```

**Production (Render/Vercel):**
- Add `DATABASE_URL` to environment variables
- Use the **Internal Database URL** from Render

---

### Step 3: Run Migrations

```bash
cd IgniteBd-Next-combine

# Generate Prisma Client
npx prisma generate

# Run all migrations
npx prisma migrate deploy

# Verify migrations applied
npx prisma migrate status
```

**Expected Output:**
```
14 migrations found in prisma/migrations

Database schema is up to date!
```

---

### Step 4: Create Your Owner Record

After migrations, create your Owner record:

#### Option A: Use Debug Route (After App is Running)
```javascript
// In browser console (while logged in)
const user = firebase.auth().currentUser;
const token = await user.getIdToken();

fetch('/api/debug/fix-owner', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: user.email,
    name: user.displayName
  })
})
.then(r => r.json())
.then(data => console.log('✅ Owner Created:', data));
```

#### Option B: Use Script
```bash
# Create a quick script
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createOwner() {
  const firebaseId = 'YOUR_FIREBASE_UID_HERE'; // Get from browser console
  const email = 'your-email@example.com';
  
  const owner = await prisma.owner.create({
    data: {
      firebaseId,
      email,
      name: 'Your Name'
    }
  });
  
  console.log('✅ Owner created:', owner);
  await prisma.\$disconnect();
}

createOwner();
"
```

#### Option C: Direct SQL
```sql
-- Get your Firebase UID first (from browser: firebase.auth().currentUser.uid)
INSERT INTO owners (id, "firebaseId", email, name, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'YOUR_FIREBASE_UID_HERE',
  'your-email@example.com',
  'Your Name',
  NOW(),
  NOW()
);
```

---

### Step 5: Create SuperAdmin (Optional)

If you need super admin access:

```bash
node scripts/create-superadmin.js your-email@example.com
```

---

### Step 6: Verify Everything Works

1. **Check Database Connection:**
   ```bash
   npx prisma db pull  # Should connect successfully
   ```

2. **Check Owner Record:**
   ```
   GET /api/debug/owner-check
   ```
   Should show `ownerFound: true`

3. **Test Billing Route:**
   ```
   GET /api/admin/billing
   ```
   Should return invoices (or empty array)

---

## 🔧 Quick Rebuild Script

Save this as `rebuild-db.sh`:

```bash
#!/bin/bash

echo "🔧 Rebuilding IgniteBd Database..."

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set!"
  echo "Set it in .env.local or environment variables"
  exit 1
fi

echo "✅ DATABASE_URL found"

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# Run migrations
echo "🚀 Running migrations..."
npx prisma migrate deploy

# Check status
echo "📊 Migration status:"
npx prisma migrate status

echo "✅ Database rebuild complete!"
echo ""
echo "Next steps:"
echo "1. Create your Owner record (see Step 4 above)"
echo "2. Test: GET /api/debug/owner-check"
echo "3. Test: GET /api/admin/billing"
```

Run it:
```bash
chmod +x rebuild-db.sh
./rebuild-db.sh
```

---

## 📊 Migration List

Your migrations (in order):
1. `20250127000000_add_superadmin_model`
2. `20250127000000_add_ultra_tenant_fk`
3. `20250127120000_add_deck_artifact`
4. `20250128000000_change_company_annual_rev_to_string`
5. `20250128000001_change_years_in_business_to_string`
6. `20250128200000_add_stripe_fields_to_invoice` ⭐ (includes Stripe fields)
7. `20251106194819_rename_companyId_to_crmId`
8. `20251112215423_add_domain_to_contacts`
9. `20251112215759_add_domain_registry`
10. `20251112215939_add_companyName_to_contacts`
11. `20251123213735_remove_cle_decks`
12. `20251202122805_add_ultra_tenant_fk`
13. `20251202134839_change_company_annual_rev_to_string`
14. `20251206024441_add_deck_artifact`

**Total: 14 migrations**

---

## ⚠️ Important Notes

### Data Loss
- **All data is lost** - invoices, contacts, work packages, etc.
- You'll need to recreate:
  - Owner record
  - CompanyHQs
  - Contacts
  - WorkPackages
  - Invoices

### Backup Strategy (For Future)
```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore database
psql $DATABASE_URL < backup_20250128.sql
```

---

## 🚀 Quick Start Commands

```bash
# 1. Set DATABASE_URL
export DATABASE_URL="postgresql://..."

# 2. Generate client
npx prisma generate

# 3. Run migrations
npx prisma migrate deploy

# 4. Verify
npx prisma migrate status

# 5. Create Owner (via API or script)
# See Step 4 above
```

---

## ✅ Verification Checklist

- [ ] Database created and accessible
- [ ] DATABASE_URL set correctly
- [ ] All 14 migrations applied
- [ ] Prisma Client generated
- [ ] Owner record created
- [ ] `/api/debug/owner-check` returns owner
- [ ] `/api/admin/billing` works (returns invoices or empty array)
- [ ] Can create invoices via `/billing/invoices/create`

---

## 🆘 Troubleshooting

### "Connection refused"
- Check DATABASE_URL format
- Verify database is running
- Check firewall/network settings

### "Migration failed"
- Check migration files exist
- Verify database permissions
- Check for conflicting migrations

### "Owner not found"
- Create Owner record (Step 4)
- Verify firebaseId matches Firebase UID
- Check Owner table exists

---

**Last Updated:** 2025-01-28  
**Priority:** 🔴 CRITICAL

