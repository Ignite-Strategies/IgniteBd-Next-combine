# Platform Billing Architecture

**Date:** 2025-01-31  
**Status:** 🟡 In Progress

---

## 🎯 Overview

**Same models, different access patterns:**
- **Super Admins** (platform-manager): Create/manage Plans and PlatformAccess
- **Owners/Companies** (IgniteBd-Next-combine): View plans, select tier, stored in PlatformAccess

---

## 📊 Data Model (IgniteBd-Next-combine - Source of Truth)

### Models
```prisma
model plans {
  id                String              @id @default(cuid())
  name              String
  description       String?
  interval          PlanInterval?
  amountCents       Int
  currency          String              @default("usd")
  stripeProductId   String?
  stripePriceId     String?             @unique
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  platform_accesses platform_accesses[]
}

model platform_accesses {
  id                   String               @id @default(cuid())
  name                 String?
  companyId            String // FK → CompanyHQ.id
  planId               String // FK → Plan.id
  status               PlatformAccessStatus @default(ACTIVE)
  stripeSubscriptionId String?              @unique
  startedAt            DateTime             @default(now())
  endedAt              DateTime?
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt
  company_hqs          company_hqs          @relation(...)
  plans                plans                @relation(...)
}
```

**Key Point:** Models live in IgniteBd-Next-combine database. Platform-manager accesses via API.

---

## 🔄 Access Patterns

### 1. Super Admin (Platform-Manager) → Create/Manage Plans

**Flow:**
```
Platform-Manager UI
  → POST /api/platform/plans
    → Calls IgniteBd-Next-combine POST /api/plans
      → Creates Plan in database
```

**Platform-Manager Route:** `app/api/platform/plans/route.js`
- Creates Plan via API call to IgniteBd-Next-combine
- Super admin only (requires auth)

**IgniteBd-Next-combine Route:** `app/api/plans/route.ts` (already exists)
- `POST` - Create plan (admin only)
- `GET` - List plans (public for selection)

---

### 2. Super Admin (Platform-Manager) → Assign PlatformAccess

**Flow:**
```
Platform-Manager UI
  → POST /api/platform/access
    → Calls IgniteBd-Next-combine POST /api/platform-access
      → Creates PlatformAccess for company
```

**Platform-Manager Route:** `app/api/platform/access/route.js` (to be created)
- Assigns PlatformAccess via API call
- For MVP1: Direct assignment for Joel

**IgniteBd-Next-combine Route:** `app/api/platform-access/route.ts` (to be created)
- `POST` - Create/update PlatformAccess
- `GET` - Get PlatformAccess for company

---

### 3. Owner/Company (IgniteBd-Next-combine) → Select Plan

**Flow:**
```
Owner Settings Page
  → GET /api/plans (list available)
  → User selects plan
  → POST /api/platform-access
    → Creates PlatformAccess for their company
```

**IgniteBd-Next-combine Routes:**
- `GET /api/plans` - List available plans (already exists)
- `POST /api/platform-access` - Create PlatformAccess when owner selects

---

## 🏗️ Implementation Plan

### Phase 1: Platform-Manager API Routes (Super Admin)

**Create in platform-manager:**

1. **`app/api/platform/plans/route.js`**
   ```javascript
   // POST - Create plan
   // Calls IgniteBd-Next-combine POST /api/plans
   ```

2. **`app/api/platform/plans/[id]/route.js`**
   ```javascript
   // GET - Get plan
   // PUT - Update plan
   // DELETE - Delete plan
   ```

3. **`app/api/platform/access/route.js`**
   ```javascript
   // POST - Assign PlatformAccess to company
   // Body: { companyId, planId }
   // Calls IgniteBd-Next-combine POST /api/platform-access
   ```

4. **`app/api/platform/access/[id]/route.js`**
   ```javascript
   // GET - Get PlatformAccess
   // PUT - Update PlatformAccess
   ```

### Phase 2: IgniteBd-Next-combine API Routes

**Create/Update in IgniteBd-Next-combine:**

1. **`app/api/platform-access/route.ts`** (NEW)
   ```typescript
   // POST - Create/update PlatformAccess
   // Body: { companyId, planId }
   // Auth: Owner (for their company) or Admin
   ```

2. **`app/api/platform-access/company/[companyId]/route.ts`** (NEW)
   ```typescript
   // GET - Get PlatformAccess for company
   // Auth: Owner (for their company) or Admin
   ```

3. **`app/api/plans/route.ts`** (EXISTS - update)
   - `GET` - List plans (public for selection)
   - `POST` - Create plan (admin only)

### Phase 3: Owner Selection UI (IgniteBd-Next-combine)

**Create:** `app/(authenticated)/settings/billing/page.jsx`
- Lists available plans
- Shows current plan (if any)
- "Select Plan" button → Creates PlatformAccess

---

## 🎯 MVP1: Direct Assignment for Joel

**For MVP1, skip selection UI:**

1. **Super admin in platform-manager:**
   - Navigate to Joel's company
   - Select plan
   - Click "Assign Plan"
   - Creates PlatformAccess via API

2. **Or via direct API call:**
   ```bash
   POST /api/platform/access
   {
     "companyId": "joel-company-id",
     "planId": "selected-plan-id"
   }
   ```

---

## 📋 API Contract

### Platform-Manager → IgniteBd-Next-combine

**Create Plan:**
```http
POST http://ignitebd-api/api/plans
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Gold Tier – Annual",
  "description": "Full access",
  "amountCents": 50000,
  "currency": "usd",
  "interval": "YEAR"
}
```

**Create PlatformAccess:**
```http
POST http://ignitebd-api/api/platform-access
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "companyId": "company-hq-id",
  "planId": "plan-id"
}
```

### IgniteBd-Next-combine → Owner

**List Plans:**
```http
GET http://ignitebd-api/api/plans
Authorization: Bearer <owner-token>
```

**Select Plan:**
```http
POST http://ignitebd-api/api/platform-access
Authorization: Bearer <owner-token>
Content-Type: application/json

{
  "planId": "selected-plan-id"
}
// companyId comes from owner's companyHQId
```

---

## ✅ Summary

**Same Models:**
- `plans` and `platform_accesses` live in IgniteBd-Next-combine
- Platform-manager accesses via API calls

**Different Access:**
- **Super Admin** (platform-manager): Creates/manages Plans and PlatformAccess
- **Owner** (IgniteBd-Next-combine): Views plans, selects tier

**MVP1:**
- Direct assignment via platform-manager for Joel
- Selection UI comes later

