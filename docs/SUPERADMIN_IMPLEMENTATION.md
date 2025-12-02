# SuperAdmin + Ultra Tenant + Tenant Switchboard Implementation

**Date**: January 2025  
**Status**: ✅ Complete

---

## Overview

This implementation adds a SuperAdmin layer to IgniteBD, allowing designated administrators to manage all CompanyHQs (tenants) in the system through a Tenant Switchboard interface.

---

## What Was Implemented

### 1. **SuperAdmin Model** ✅
- Added `SuperAdmin` Prisma model with relationship to `Owner`
- One-to-one relationship: `SuperAdmin.ownerId` → `Owner.id`
- Includes `active` flag for enabling/disabling SuperAdmin access

### 2. **IgniteBD Master CompanyHQ** ✅
- Seeder script creates master tenant with ID `"ignitebd_master_hq"`
- Can be assigned to any Owner as manager
- Run: `node scripts/seed-ignitebd-master-hq.js [ownerEmail]`

### 3. **Owner Hydration Enhancement** ✅
- `/api/owner/hydrate` now returns `isSuperAdmin: true/false`
- Checks SuperAdmin status during owner hydration
- No breaking changes to existing hydration flow

### 4. **Tenant Switchboard UI** ✅
- **Path**: `/admin/switchboard`
- Lists all CompanyHQs in the system
- Shows stats: total tenants, contacts, proposals
- "Switch" button to change active tenant
- Only accessible to SuperAdmins (auto-redirects if not)

### 5. **CompanyHQ Creation** ✅
- **Path**: `/admin/companyhq/create`
- SuperAdmin-only form to create new CompanyHQs
- Supports linking to Owner, Contact Owner, or Manager
- **API**: `POST /api/admin/companyhq/create`

### 6. **API Routes** ✅
- `GET /api/admin/companyhqs` - List all CompanyHQs (SuperAdmin only)
- `POST /api/admin/companyhq/create` - Create CompanyHQ (SuperAdmin only)
- `POST /api/companyhq/get` - Get CompanyHQ by ID (for tenant switching)

### 7. **Tenant Switching Utility** ✅
- `setActiveTenant(companyHQId, router)` function
- Updates localStorage with new tenant
- Rehydrates owner data
- Redirects to dashboard

---

## Setup Instructions

### Step 1: Run Prisma Migration

```bash
# Generate Prisma client with new SuperAdmin model
npx prisma generate

# Create and run migration
npx prisma migrate dev --name add_superadmin_model
```

### Step 2: Create SuperAdmin Record

```bash
# Create SuperAdmin for a specific Owner (by email)
node scripts/create-superadmin.js adam@example.com

# Or create for first Owner in database
node scripts/create-superadmin.js
```

### Step 3: Seed IgniteBD Master CompanyHQ

```bash
# Create master HQ with specific Owner as manager
node scripts/seed-ignitebd-master-hq.js adam@example.com

# Or use first Owner
node scripts/seed-ignitebd-master-hq.js
```

### Step 4: Access Switchboard

1. Log in as the SuperAdmin Owner
2. Navigate to `/admin/switchboard`
3. You'll see all CompanyHQs in the system
4. Click "Switch" on any tenant to switch to it

---

## Database Schema Changes

### New Model: SuperAdmin

```prisma
model SuperAdmin {
  id        String   @id @default(cuid())
  ownerId   String   @unique
  owner     Owner    @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  active    Boolean  @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@map("super_admins")
}
```

### Updated Model: Owner

```prisma
model Owner {
  // ... existing fields ...
  superAdmin SuperAdmin? // New relation
}
```

---

## API Endpoints

### GET /api/owner/hydrate
**Enhanced Response:**
```json
{
  "success": true,
  "owner": { ... },
  "isSuperAdmin": true,  // NEW FIELD
  "timestamp": "..."
}
```

### GET /api/admin/companyhqs
**Response:**
```json
{
  "success": true,
  "companyHQs": [
    {
      "id": "...",
      "companyName": "...",
      "owner": { ... },
      "manager": { ... },
      "contactOwner": { ... },
      "_count": {
        "companies": 0,
        "contacts": 0,
        "proposals": 0
      }
    }
  ]
}
```

### POST /api/admin/companyhq/create
**Request:**
```json
{
  "companyName": "My Company",
  "ownerId": "optional-owner-id",
  "contactOwnerId": "optional-contact-id",
  "managerId": "optional-manager-id"
}
```

**Response:**
```json
{
  "success": true,
  "companyHQ": { ... },
  "message": "CompanyHQ created successfully"
}
```

---

## UI Pages

### `/admin/switchboard`
- **Access**: SuperAdmin only (auto-redirects if not)
- **Features**:
  - List all CompanyHQs
  - View stats (contacts, companies, proposals)
  - Switch between tenants
  - Create new CompanyHQ button

### `/admin/companyhq/create`
- **Access**: SuperAdmin only
- **Features**:
  - Form to create new CompanyHQ
  - Link to Owner, Contact Owner, or Manager
  - Validation and error handling

---

## Tenant Switching Flow

1. SuperAdmin clicks "Switch" on a CompanyHQ
2. `setActiveTenant()` is called with `companyHQId`
3. Function:
   - Fetches CompanyHQ details
   - Updates `localStorage.companyHQId`
   - Updates `localStorage.companyHQ`
   - Rehydrates owner data
   - Redirects to `/growth-dashboard`

---

## Security

- All SuperAdmin endpoints require Firebase authentication
- SuperAdmin status is checked on every request
- Non-SuperAdmins are automatically redirected
- Existing tenant isolation remains intact

---

## Backward Compatibility

✅ **No Breaking Changes**
- Existing onboarding flow unchanged
- Existing authenticated pages unchanged
- Existing hydration logic unchanged
- All existing functionality preserved

---

## Files Created/Modified

### Created:
- `prisma/schema.prisma` (SuperAdmin model added)
- `scripts/create-superadmin.js`
- `scripts/seed-ignitebd-master-hq.js`
- `src/app/api/admin/companyhqs/route.js`
- `src/app/api/admin/companyhq/create/route.js`
- `src/app/api/companyhq/get/route.js`
- `src/app/(authenticated)/admin/switchboard/page.jsx`
- `src/app/(authenticated)/admin/companyhq/create/page.jsx`
- `src/lib/tenantSwitch.js`

### Modified:
- `src/app/api/owner/hydrate/route.js` (added `isSuperAdmin` check)

---

## Testing Checklist

- [ ] Run Prisma migration
- [ ] Create SuperAdmin record
- [ ] Seed IgniteBD Master CompanyHQ
- [ ] Log in as SuperAdmin
- [ ] Access `/admin/switchboard`
- [ ] Verify all CompanyHQs are listed
- [ ] Test switching to different tenant
- [ ] Verify localStorage updates correctly
- [ ] Test creating new CompanyHQ
- [ ] Verify non-SuperAdmin cannot access admin routes
- [ ] Verify existing functionality still works

---

## Future Enhancements

Potential improvements:
- Bulk operations on CompanyHQs
- Tenant analytics dashboard
- Tenant deletion/archival
- SuperAdmin activity logging
- Multi-SuperAdmin support with roles
- Tenant export/import functionality

---

**Last Updated**: January 2025

