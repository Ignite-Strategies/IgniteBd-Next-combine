# SuperAdmin Architecture

**Last Updated**: January 2025  
**Status**: Phase 1 - Core SuperAdmin Implementation  
**Purpose**: Complete architecture documentation for the SuperAdmin system

---

## 🎯 Overview

The SuperAdmin system provides platform-level administration capabilities for IgniteBD. SuperAdmins can:
- Manage all CompanyHQs (tenants)
- Switch between tenants
- Create new CompanyHQs
- Access platform-wide features

**Key Principle**: SuperAdmin is a role attached to an Owner, not a separate user type.

---

## 📊 Database Model

### SuperAdmin Model

**Location:** `prisma/schema.prisma`

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

### Owner Model (Updated)

```prisma
model Owner {
  // ... existing fields ...
  superAdmin SuperAdmin? // One-to-one relationship
  // ... rest of fields ...
}
```

### Relationships

- **SuperAdmin → Owner**: One-to-one, unique
  - `SuperAdmin.ownerId` → `Owner.id`
  - Cascade delete: If Owner is deleted, SuperAdmin is deleted
  - Unique constraint: One Owner can only have one SuperAdmin record

---

## 🔐 Authentication & Authorization

### Flow

1. **User Authentication**: Standard Firebase Auth flow
2. **Owner Hydration**: `/api/owner/hydrate` checks for SuperAdmin status
3. **SuperAdmin Check**: `isSuperAdmin: true/false` returned in hydration response
4. **Access Control**: Client-side and server-side checks based on `isSuperAdmin`

### Authorization Pattern

```javascript
// Client-side check
const { owner } = useOwnerStore();
if (!owner?.isSuperAdmin) {
  redirect('/growth-dashboard');
}

// Server-side check (API routes)
const owner = await prisma.owner.findUnique({
  where: { firebaseId: firebaseUser.uid },
  include: { superAdmin: true },
});

if (!owner?.superAdmin?.active) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

---

## 🛣️ API Routes

### POST /api/superadmin/create

**Purpose**: Create a SuperAdmin record for the authenticated Owner

**Location**: `src/app/api/superadmin/create/route.js`

**Request**:
- Method: `POST`
- Headers: `Authorization: Bearer <firebase-token>`
- Body: None (uses authenticated Owner)

**Response**:
```json
{
  "success": true,
  "superAdmin": {
    "id": "clx...",
    "ownerId": "clx...",
    "active": true,
    "createdAt": "2025-01-27T...",
    "updatedAt": "2025-01-27T..."
  }
}
```

**Error Responses**:
- `401`: No Firebase token
- `404`: Owner not found
- `500`: Database error

**Implementation**:
```javascript
export async function POST(request) {
  // 1. Verify Firebase token
  const firebaseUser = await verifyFirebaseToken(request);
  
  // 2. Find Owner by firebaseId
  const owner = await prisma.owner.findUnique({
    where: { firebaseId: firebaseUser.uid },
  });
  
  // 3. Create SuperAdmin record
  const superAdmin = await prisma.superAdmin.create({
    data: {
      ownerId: owner.id,
      active: true,
    },
  });
  
  return NextResponse.json({ success: true, superAdmin });
}
```

### GET /api/owner/hydrate (Enhanced)

**Purpose**: Hydrate Owner data, including SuperAdmin status

**Response**:
```json
{
  "success": true,
  "owner": { ... },
  "isSuperAdmin": true,  // NEW: SuperAdmin status
  "timestamp": "..."
}
```

**Implementation**:
```javascript
// After loading Owner
const superAdmin = await prisma.superAdmin.findUnique({
  where: { ownerId: owner.id },
});

const isSuperAdmin = superAdmin?.active === true;

return NextResponse.json({
  success: true,
  owner: hydratedOwner,
  isSuperAdmin: isSuperAdmin,
});
```

### GET /api/admin/companyhqs

**Purpose**: List all CompanyHQs (SuperAdmin only)

**Authorization**: Requires `isSuperAdmin === true`

**Response**:
```json
{
  "success": true,
  "companyHQs": [
    {
      "id": "...",
      "companyName": "...",
      "owner": { ... },
      "manager": { ... },
      "_count": {
        "companies": 5,
        "contacts": 120,
        "proposals": 3
      }
    }
  ]
}
```

### POST /api/admin/companyhq/create

**Purpose**: Create a new CompanyHQ (SuperAdmin only)

**Authorization**: Requires `isSuperAdmin === true`

**Request**:
```json
{
  "companyName": "New Company",
  "ownerId": "optional-owner-id",
  "contactOwnerId": "optional-contact-id"
}
```

**Response**:
```json
{
  "success": true,
  "companyHQ": { ... }
}
```

---

## 🎨 UI Components

### SuperAdmin Initialize Page

**Location**: `src/app/(authenticated)/superadmin/initialize/page.jsx`

**Flow**:
1. Load Owner from localStorage (already hydrated from welcome)
2. Show welcome message: "Welcome, [Name]!"
3. Display: "Would you like to become a SuperAdmin?"
4. Button: "Yes, Make Me SuperAdmin"
5. On click → POST `/api/superadmin/create`
6. On success → Show success message + navigation options

**Key Features**:
- No hydration calls on page load
- Simple, modular flow
- Clear user feedback

### Tenant Switchboard

**Location**: `src/app/(authenticated)/admin/switchboard/page.jsx`

**Purpose**: List all CompanyHQs and allow switching between them

**Features**:
- Fetches all CompanyHQs via `/api/admin/companyhqs`
- Displays tenant cards with stats
- "Switch" button updates `localStorage.companyHQId` and redirects

### CompanyHQ Creation

**Location**: `src/app/(authenticated)/admin/companyhq/create/page.jsx`

**Purpose**: Create new CompanyHQs from admin interface

---

## 🔄 Data Flow

### SuperAdmin Creation Flow

```
User clicks "Make Me SuperAdmin"
  ↓
POST /api/superadmin/create
  ↓
Verify Firebase Token
  ↓
Find Owner by firebaseId
  ↓
Create SuperAdmin { ownerId: owner.id, active: true }
  ↓
Return success
  ↓
Update UI / Redirect
```

### Owner Hydration Flow (with SuperAdmin)

```
Page Load / Refresh
  ↓
GET /api/owner/hydrate
  ↓
Verify Firebase Token
  ↓
Find Owner by firebaseId
  ↓
Check SuperAdmin: prisma.superAdmin.findUnique({ where: { ownerId } })
  ↓
Return { owner, isSuperAdmin: true/false }
  ↓
Store in global state / localStorage
```

### Tenant Switching Flow

```
SuperAdmin clicks "Switch" on tenant
  ↓
Update localStorage.companyHQId = newHQId
  ↓
Redirect to /growth-dashboard
  ↓
Dashboard reads from localStorage.companyHQId
  ↓
All subsequent API calls scoped to new tenant
```

---

## 📁 File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── superadmin/
│   │   │   └── create/
│   │   │       └── route.js          # Create SuperAdmin
│   │   ├── admin/
│   │   │   ├── companyhqs/
│   │   │   │   └── route.js          # List all CompanyHQs
│   │   │   └── companyhq/
│   │   │       └── create/
│   │   │           └── route.js      # Create CompanyHQ
│   │   └── owner/
│   │       └── hydrate/
│   │           └── route.js          # Enhanced with isSuperAdmin
│   └── (authenticated)/
│       ├── superadmin/
│       │   └── initialize/
│       │       └── page.jsx           # SuperAdmin initialization UI
│       └── admin/
│           ├── switchboard/
│           │   └── page.jsx          # Tenant switchboard
│           └── companyhq/
│               └── create/
│                   └── page.jsx      # Create CompanyHQ UI
├── lib/
│   └── tenant.js                     # Tenant switching utilities
└── stores/
    └── ownerStore.js                  # Global owner state (includes isSuperAdmin)
```

---

## 🧪 Testing

### Manual Testing Steps

1. **Create SuperAdmin**:
   - Navigate to `/superadmin/initialize`
   - Click "Yes, Make Me SuperAdmin"
   - Verify success message

2. **Verify Hydration**:
   - Check `/api/owner/hydrate` response
   - Verify `isSuperAdmin: true` in response

3. **Access Switchboard**:
   - Navigate to `/admin/switchboard`
   - Verify all CompanyHQs are listed
   - Test tenant switching

4. **Create CompanyHQ**:
   - Navigate to `/admin/companyhq/create`
   - Create new CompanyHQ
   - Verify it appears in switchboard

---

## 🔮 Future Enhancements (Phase 2)

### Ultra Tenant Container

- **IgniteBD Master CompanyHQ**: Special tenant for platform administration
- **ID**: `ignitebd_master_hq`
- **Purpose**: Platform-level data and operations

### Enhanced Authorization

- Role-based permissions
- Audit logging
- Activity tracking

### Multi-Tenant Management

- Bulk operations
- Tenant analytics
- Resource usage tracking

---

## 📝 Notes

- **SuperAdmin is NOT a separate user type**: It's a role attached to an Owner
- **One Owner = One SuperAdmin record**: Enforced by unique constraint
- **Cascade delete**: If Owner is deleted, SuperAdmin is automatically deleted
- **Active flag**: Allows soft-deactivation without deleting record
- **No email restrictions in Phase 1**: Any authenticated Owner can become SuperAdmin
- **Future**: Add email whitelist or other restrictions in Phase 2

---

## 🚨 Important Considerations

1. **Security**: SuperAdmin has access to ALL tenants - implement proper authorization checks
2. **Audit**: Consider logging all SuperAdmin actions
3. **Rate Limiting**: Protect SuperAdmin endpoints from abuse
4. **Backup**: SuperAdmin deletion should be reversible (use `active: false` instead of delete)

---

## 📚 Related Documentation

- [SuperAdmin Implementation](./SUPERADMIN_IMPLEMENTATION.md)
- [SuperAdmin Current State](./SUPERADMIN_CURRENT_STATE.md)
- [Architecture Overview](./architecture/ignitebd-architectureoverview.md)

