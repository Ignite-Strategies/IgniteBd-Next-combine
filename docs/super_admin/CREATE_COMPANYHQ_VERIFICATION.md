# Create CompanyHQ Verification Guide

**Date**: January 2025  
**Purpose**: Verify routes and model before creating Joel's BusinessPoint Law CompanyHQ

---

## 🎯 Current Architecture

### CompanyHQ Creation Routes

#### 1. **SuperAdmin Route** (Current)
**Endpoint**: `POST /api/admin/companyhq/create`

**Location**: `src/app/api/admin/companyhq/create/route.js`

**Authorization**: 
- ✅ Requires SuperAdmin status
- ✅ Verifies Firebase token
- ✅ Checks `owner.superAdmin.active === true`

**Request Body**:
```json
{
  "companyName": "BusinessPoint Law",
  "ownerId": "optional-owner-id",
  "contactOwnerId": "optional-contact-id",
  "managerId": "optional-manager-id"
}
```

**Auto-Assignments**:
- ✅ `ultraTenantId` = `"cmhmdw78k0001mb1vioxdw2g8"` (Ignite Strategies)
- ✅ All new CompanyHQs automatically become children of Ignite Strategies

**Response**:
```json
{
  "success": true,
  "companyHQ": {
    "id": "...",
    "companyName": "BusinessPoint Law",
    "ultraTenantId": "cmhmdw78k0001mb1vioxdw2g8",
    "owner": { ... },
    "manager": { ... },
    "ultraTenant": {
      "id": "cmhmdw78k0001mb1vioxdw2g8",
      "companyName": "Ignite Strategies"
    },
    "subTenants": []
  }
}
```

**Usage**: 
- SuperAdmin creates CompanyHQs via `/admin/companyhq/create` UI
- Or direct API call from SuperAdmin context

---

#### 2. **Regular Owner Route** (Future - Not Yet Implemented)
**Endpoint**: `POST /api/companyhq/create` (doesn't exist yet)

**Planned Behavior**:
- ✅ Will be accessible to regular Owners (not just SuperAdmin)
- ✅ Will auto-assign `ownerId` from authenticated Owner
- ✅ Will auto-assign `ultraTenantId` = Ignite Strategies
- ✅ Will be used for "front door" onboarding

**Note**: This route doesn't exist yet. Currently only SuperAdmin can create CompanyHQs.

---

## 📊 Database Model

### CompanyHQ Schema

```prisma
model CompanyHQ {
  id                   String      @id @default(cuid())
  companyName          String      // Required
  companyIndustry      String?
  companyAnnualRev     Float?
  yearsInBusiness      Int?
  teamSize             String?
  companyCity          String?
  companyState         String?
  companyStreet        String?
  companyWebsite       String?
  whatYouDo            String?
  
  // Ownership
  ownerId              String?     // Owner.id (optional)
  managerId            String?     // Owner.id (optional manager)
  contactOwnerId       String?     // Contact.id (optional)
  
  // Ultra Tenant Relationship
  ultraTenantId        String?     // Parent tenant (null for root)
  ultraTenant          CompanyHQ?  @relation("UltraTenantChildren", ...)
  subTenants           CompanyHQ[] @relation("UltraTenantChildren")
  
  // Relations
  companies            Company[]
  contacts             Contact[]
  proposals            Proposal[]
  // ... other relations
  
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
}
```

### Key Fields for BusinessPoint Law

**Required**:
- `companyName`: "BusinessPoint Law"

**Optional but Recommended**:
- `companyIndustry`: "Legal Services" or "Law Firm"
- `whatYouDo`: Description of services
- `companyCity`, `companyState`: Location
- `companyWebsite`: Website URL

**Auto-Assigned**:
- `ultraTenantId`: `"cmhmdw78k0001mb1vioxdw2g8"` (Ignite Strategies)
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

**Can Be Set Later**:
- `ownerId`: Can be assigned when Owner signs up
- `managerId`: Can be assigned for management
- `contactOwnerId`: If Contact becomes owner

---

## 🔄 Creation Flow for BusinessPoint Law

### Option 1: Via SuperAdmin UI (Current)

1. **Navigate to**: `/admin/companyhq/create`
2. **Fill Form**:
   - Company Name: "BusinessPoint Law"
   - (Optional) Owner ID: Leave blank (can add later)
   - (Optional) Manager ID: Leave blank
3. **Submit**: Creates CompanyHQ with:
   - `companyName` = "BusinessPoint Law"
   - `ultraTenantId` = Ignite Strategies (auto)
   - `ownerId` = null (can add later)

### Option 2: Via API Call (SuperAdmin)

```javascript
// From SuperAdmin context (e.g., switchboard page)
const response = await api.post('/api/admin/companyhq/create', {
  companyName: 'BusinessPoint Law',
  // ownerId: null, // Can add later when Joel signs up
});
```

**Result**:
- ✅ CompanyHQ created
- ✅ Linked to Ignite Strategies as child
- ✅ `ownerId` can be added later when Joel creates Owner account

---

## 🔮 Future: Front Door Onboarding

### Planned Route: `POST /api/companyhq/create`

**When Implemented**:
- Regular Owners can create their own CompanyHQ
- Auto-assigns `ownerId` from authenticated Owner
- Auto-assigns `ultraTenantId` = Ignite Strategies
- Used during signup/onboarding flow

**Flow**:
```
1. User signs up → Creates Owner
2. User creates CompanyHQ → POST /api/companyhq/create
3. System auto-assigns:
   - ownerId = current Owner.id
   - ultraTenantId = Ignite Strategies
4. User can now access their tenant
```

**Current Status**: ❌ Not implemented yet

---

## ✅ Verification Checklist for BusinessPoint Law

### Before Creation

- [ ] SuperAdmin is authenticated
- [ ] SuperAdmin status verified (`isSuperAdmin === true`)
- [ ] Ultra Tenant (Ignite Strategies) exists in database
- [ ] Migration has been run (ultraTenantId column exists)

### During Creation

- [ ] Company Name: "BusinessPoint Law"
- [ ] `ultraTenantId` auto-assigned to Ignite Strategies
- [ ] `ownerId` can be null (will add later)
- [ ] Response includes `ultraTenant` relation

### After Creation

- [ ] CompanyHQ appears in switchboard
- [ ] Shows "Child of Ignite Strategies" badge
- [ ] Can switch to BusinessPoint Law tenant
- [ ] `ownerId` can be updated later when Joel signs up

---

## 📝 Example API Call

### Create BusinessPoint Law (SuperAdmin)

```bash
curl -X POST https://app.ignitegrowth.biz/api/admin/companyhq/create \
  -H "Authorization: Bearer <firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "BusinessPoint Law"
  }'
```

### Expected Response

```json
{
  "success": true,
  "companyHQ": {
    "id": "clx...",
    "companyName": "BusinessPoint Law",
    "ultraTenantId": "cmhmdw78k0001mb1vioxdw2g8",
    "ownerId": null,
    "managerId": null,
    "contactOwnerId": null,
    "ultraTenant": {
      "id": "cmhmdw78k0001mb1vioxdw2g8",
      "companyName": "Ignite Strategies"
    },
    "subTenants": [],
    "createdAt": "2025-01-27T...",
    "updatedAt": "2025-01-27T..."
  },
  "message": "CompanyHQ created successfully"
}
```

---

## 🔗 Related Routes

### List All CompanyHQs
**Endpoint**: `GET /api/admin/companyhqs`  
**Auth**: SuperAdmin only  
**Returns**: All CompanyHQs with `ultraTenant` and `subTenants` relations

### Update CompanyHQ
**Endpoint**: `PUT /api/company/upsert`  
**Auth**: Owner (updates their own CompanyHQ)  
**Note**: Can update `ownerId` later when Joel signs up

### Get CompanyHQ
**Endpoint**: `GET /api/companyhq/[id]` (if exists)  
**Returns**: Single CompanyHQ with relations

---

## 🎯 Summary

### Current State
- ✅ **SuperAdmin Route**: `/api/admin/companyhq/create` - Works, requires SuperAdmin
- ✅ **Auto-Assignment**: `ultraTenantId` automatically set to Ignite Strategies
- ✅ **Flexible**: `ownerId` can be null and added later
- ❌ **Front Door Route**: `/api/companyhq/create` - Not implemented yet

### For BusinessPoint Law
1. Use SuperAdmin route: `/api/admin/companyhq/create`
2. Create with `companyName: "BusinessPoint Law"`
3. `ownerId` can be null initially
4. Later, when Joel signs up, update CompanyHQ with his `ownerId`

### Future Enhancement
- Implement `/api/companyhq/create` for regular Owners
- Auto-assign `ownerId` from authenticated Owner
- Use during onboarding flow

---

## 📚 Related Documentation

- [SuperAdmin Architecture](./SUPERADMIN_ARCHITECTURE.md)
- [Ultra Tenant Analysis](./ULTRA_TENANT_ANALYSIS.md)
- [Prisma Schema](../../prisma/schema.prisma)

