# 🎯 IGNITE ULTRA / TENANT / OWNERSHIP MODEL AUDIT

**Date**: December 2024  
**Purpose**: Audit multi-tenant architecture for Contact-to-Owner elevation support  
**Status**: ✅ Schema supports use case as-is

---

## AUDIT OBJECTIVE

Determine whether the current Ignite architecture safely supports:

- ✅ A platform-level ultra container
- ✅ A personal CRM (IgniteBD) where contacts exist in one user's orbit
- ✅ Client tenants (CompanyHQ) owned by an existing Contact
- ✅ Cross-context ownership without duplicating contacts or mutating identity

---

## 1. PLATFORM ROOT

### Finding: Ultra Container EXISTS (Partially Implemented)

**Model**: `company_hqs` (schema line 172)

**Key Fields**:
```prisma
model company_hqs {
  id              String       @id
  companyName     String
  ownerId         String?      // Legacy: points to owners table
  contactOwnerId  String?      // NEW: Contact can own CompanyHQ
  ultraTenantId   String?      // Self-reference for hierarchy
  
  // Self-referential relation
  company_hqs     company_hqs? @relation("company_hqsTocompany_hqs", fields: [ultraTenantId], references: [id])
  other_company_hqs company_hqs[] @relation("company_hqsTocompany_hqs")
}
```

**What This Enables**:
- IgniteBD = Ultra CompanyHQ (no `ultraTenantId`)
- Joel's CRM = Child CompanyHQ (has `ultraTenantId` pointing to IgniteBD)
- Hierarchical tenant structure

**Entities Scoped to CompanyHQ**:
- `Contact.crmId` → CompanyHQ (required)
- `consultant_deliverables.companyHQId` → CompanyHQ
- `company_memberships.companyHqId` → CompanyHQ
- `personas`, `products`, `proposals`, `workPackages`, etc.

**Verdict**: CompanyHQ functions as both the **ultra root** AND **individual tenant container** via self-reference.

---

## 2. CONTACT SCOPE AUDIT

### Model: Contact (schema line 269)

**Key Fields**:
```prisma
model Contact {
  id              String   @id @default(uuid())
  crmId           String   // REQUIRED - FK to CompanyHQ (where Contact "lives")
  email           String?  @unique  // Globally unique across platform
  firebaseUid     String?  @unique  // Optional, unique when set
  ownerId         String?  // Optional owner reference
  role            String   @default("contact")  // "contact", "owner", etc.
  contactCompanyId String? // Optional - Contact's external company
  
  // Relations
  company_hqs_contacts_crmIdTocompany_hqs CompanyHQ @relation(...)
  company_hqs_company_hqs_contactOwnerIdTocontacts company_hqs[] @relation(...)
}
```

**Critical Constraints**:
- ✅ `email` is globally unique (one Contact per email)
- ✅ `crmId` is required (Contact must live in exactly one CompanyHQ)
- ✅ `firebaseUid` is unique when set (one Firebase UID per Contact)
- ❌ **No constraint prevents** Contact from being referenced by multiple CompanyHQs via `contactOwnerId`

**What This Means**:

```
Contact.crmId = "adam-companyhq-id"        ← Joel LIVES in Adam's CRM
CompanyHQ.contactOwnerId = "joel-id"       ← Joel OWNS his own CRM
```

**Conclusion**: 

✅ **Contact is globally unique by email**  
✅ **Contact is tenant-scoped by `crmId` (where they live)**  
✅ **Contact can own OTHER CompanyHQs via `contactOwnerId` relation**  
✅ **NO duplication required**

---

## 3. OWNERSHIP SEMANTICS

### Finding: THREE Ownership Models Coexist

#### A. Legacy Owner Model (`owners` table)

```prisma
model owners {
  id                                      String        @id
  firebaseId                              String        @unique
  company_hqs_company_hqs_ownerIdToowners company_hqs[] @relation(...)
}
```

**Characteristics**:
- Structural FK: `CompanyHQ.ownerId → owners.id`
- Separate identity system from Contact
- Used for original IgniteBD platform owners

#### B. Contact-As-Owner Model ⭐ **YOUR USE CASE**

```prisma
CompanyHQ {
  contactOwnerId String?
  contacts_company_hqs_contactOwnerIdTocontacts Contact? @relation(...)
}
```

**Characteristics**:
- Structural FK: `CompanyHQ.contactOwnerId → Contact.id`
- **Allows Contact to own CompanyHQ**
- Contact remains in original CRM (`crmId`) while owning new CRM

**Example**:
```javascript
// Joel as Contact in Adam's CRM
Contact {
  id: "joel-contact-id",
  crmId: "adam-companyhq-id",     // Joel lives here
  firebaseUid: "joel-firebase-uid",
  role: "owner"                    // Can be elevated
}

// Joel's Own CRM
CompanyHQ {
  id: "joel-companyhq-id",
  contactOwnerId: "joel-contact-id",  // Joel owns this
  ultraTenantId: "adam-companyhq-id"  // Under Adam's ultra
}
```

#### C. Membership-Based Ownership (Operational)

```prisma
model company_memberships {
  id          String   @id
  userId      String   // firebaseUid (from Contact or Owner)
  companyHqId String
  role        String   // "owner", "client", "member"
  isPrimary   Boolean  // Which CRM is default
  
  @@unique([userId, companyHqId])
}
```

**Characteristics**:
- Role-based (not structural FK)
- Multi-tenant access control
- Bridges both identity systems (Contact.firebaseUid and owners.firebaseId)

**Example**:
```javascript
// Joel as owner of his CRM
company_memberships {
  userId: "joel-firebase-uid",
  companyHqId: "joel-companyhq-id",
  role: "owner",
  isPrimary: true
}

// Joel as client in Adam's CRM
company_memberships {
  userId: "joel-firebase-uid",
  companyHqId: "adam-companyhq-id",
  role: "client",
  isPrimary: false
}
```

### What Actually Defines Ownership Today?

1. **Structural (Legacy)**: `CompanyHQ.ownerId` → `owners.id`
2. **Structural (New)**: `CompanyHQ.contactOwnerId` → `Contact.id` ⭐
3. **Operational**: `company_memberships.role = "owner"`

**Enforcement**:
- ❌ No DB-level constraint enforces single owner
- ✅ Unique constraint on `(userId, companyHqId)` prevents duplicate memberships
- ⚠️ Three systems require careful coordination

---

## 4. FIREBASE IDENTITY BINDING

### Finding: TWO SEPARATE FIREBASE IDENTITY SYSTEMS

#### Contact Identity (Client Portal)
```prisma
Contact.firebaseUid String? @unique
```
- **Optional** (nullable)
- **Unique when set**
- Used for: Client portal access, invite system, CRM access

#### Owner Identity (Platform)
```prisma
owners.firebaseId String @unique
```
- **Required** (not nullable)
- **Unique**
- Used for: IgniteBD platform owners (legacy system)

### System Assumptions

✅ **One Firebase UID ↔ One Contact** (when `firebaseUid` is set)  
✅ **One Firebase UID ↔ One Owner** (always)  
⚠️ **Separate pools** - Contact and Owner use different Firebase identity fields

### Membership Bridge

```prisma
company_memberships.userId String  // No FK constraint
```

**Can be**:
- `Contact.firebaseUid` (when Contact has been activated)
- `owners.firebaseId` (when legacy owner)

**No formal constraint** - just string matching at application level

---

## 5. THE CRITICAL VERDICT

### Can Joel remain a Contact in Adam's IgniteBD AND own his own CompanyHQ?

# ✅ YES — FULLY SUPPORTED AS-IS

### Schema Evidence

**Joel's Single Identity**:
```javascript
Contact {
  id: "joel-contact-id",
  email: "joel@businesspointlaw.com",    // Globally unique
  firebaseUid: "joel-firebase-uid",      // ONE Firebase identity
  crmId: "adam-companyhq-id",            // Lives in Adam's CRM
  role: "owner"                          // Elevated role
}
```

**Joel's Owned CRM**:
```javascript
CompanyHQ {
  id: "joel-crm-id",
  companyName: "Joel's CRM",
  contactOwnerId: "joel-contact-id",     // Joel OWNS this
  ultraTenantId: "adam-companyhq-id"     // Under Adam's ultra
}
```

**Joel's Memberships** (Multi-Tenant Access):
```javascript
// Owner of his CRM
company_memberships {
  userId: "joel-firebase-uid",
  companyHqId: "joel-crm-id",
  role: "owner",
  isPrimary: true                        // Default CRM
}

// Client in Adam's CRM
company_memberships {
  userId: "joel-firebase-uid",
  companyHqId: "adam-companyhq-id",
  role: "client",
  isPrimary: false
}
```

### Why It Works

1. ✅ **Single Contact Row**: Joel is ONE Contact record (no duplication)
2. ✅ **Single Firebase Identity**: Joel has ONE `firebaseUid`
3. ✅ **Multi-Tenant Membership**: Joel belongs to BOTH CompanyHQs via memberships
4. ✅ **Dual Role**: "client" in Adam's CRM, "owner" in his own
5. ✅ **Structural Ownership**: `contactOwnerId` creates ownership WITHOUT duplicating Contact
6. ✅ **No Scoping Conflict**: 
   - `Contact.crmId` = where Joel LIVES
   - `CompanyHQ.contactOwnerId` = what Joel OWNS

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ ADAM'S IGNITEBD (Ultra CompanyHQ)                      │
│ id: "adam-companyhq-id"                                 │
│ ultraTenantId: null (IS the ultra)                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────────────────────────┐            │
│  │ Joel Contact                           │            │
│  │ crmId: "adam-companyhq-id"            │            │
│  │ firebaseUid: "joel-firebase-uid"      │────────┐   │
│  │ role: "owner"                         │        │   │
│  └────────────────────────────────────────┘        │   │
│                                                    │   │
└────────────────────────────────────────────────────┼───┘
                                                     │
                    ┌────────────────────────────────┘
                    │ Same Firebase Identity
                    │
        ┌───────────▼──────────────────────────────────┐
        │ JOEL'S CRM (Child CompanyHQ)                 │
        │ id: "joel-crm-id"                            │
        │ contactOwnerId: "joel-contact-id"            │
        │ ultraTenantId: "adam-companyhq-id"          │
        └──────────────────────────────────────────────┘
```

---

## 6. REQUIRED CHANGES

### ⚠️ SCHEMA: NONE

**The schema already supports the use case perfectly.**

### ✅ APPLICATION-LEVEL REQUIREMENTS

#### 1. Promotion Service (Already Exists)

**File**: `/lib/services/promotion.js`

**What it does**:
- ✅ Creates new CompanyHQ
- ✅ Sets `contactOwnerId = contact.id`
- ✅ Creates owner membership
- ✅ Preserves client membership in original CRM
- ✅ Updates Contact role to "owner"

#### 2. Authentication Router (Needs Implementation)

**Requirements**:
```javascript
// On login:
1. Verify Firebase token → get firebaseUid
2. Find Contact by firebaseUid
3. Query company_memberships for all tenants
4. Use isPrimary=true to determine default CRM
5. Allow context-switching between tenants
```

#### 3. Pre-Seeding Script (Your Request)

**Use Case**: Superadmin sets up Joel's CRM before Joel logs in

**Script Steps**:
```javascript
// 1. Create Firebase user (server-side, before login)
const firebaseUser = await admin.auth().createUser({
  email: 'joel@businesspointlaw.com',
  displayName: 'Joel Gulick',
  emailVerified: false
});

// 2. Create Contact in Adam's CRM with firebaseUid pre-linked
const contact = await prisma.contact.create({
  data: {
    email: 'joel@businesspointlaw.com',
    firstName: 'Joel',
    lastName: 'Gulick',
    firebaseUid: firebaseUser.uid,     // Pre-seeded!
    crmId: adamCompanyHqId,            // Lives in Adam's CRM
    role: 'contact'                     // Start as contact
  }
});

// 3. Create Joel's CompanyHQ
const joelCRM = await prisma.companyHQ.create({
  data: {
    companyName: "Joel's CRM",
    contactOwnerId: contact.id,         // Joel owns this
    ultraTenantId: adamCompanyHqId      // Under Adam's ultra
  }
});

// 4. Create owner membership
await prisma.companyMembership.create({
  data: {
    userId: firebaseUser.uid,
    companyHqId: joelCRM.id,
    role: 'owner',
    isPrimary: true                     // Default CRM
  }
});

// 5. Create client membership in Adam's CRM
await prisma.companyMembership.create({
  data: {
    userId: firebaseUser.uid,
    companyHqId: adamCompanyHqId,
    role: 'client',
    isPrimary: false
  }
});

// 6. Update Contact role
await prisma.contact.update({
  where: { id: contact.id },
  data: { role: 'owner' }
});
```

**Now when Joel logs in**:
- Firebase authenticates → Returns pre-seeded `firebaseUid`
- System finds Contact by `firebaseUid`
- Contact has `crmId` = Adam's CRM (history preserved)
- Memberships show Joel owns his CRM (primary) and is client in Adam's (secondary)
- No invitation code needed - email matches pre-seeded Firebase user

---

## 7. KEY ARCHITECTURAL INSIGHTS

### Contact is Universal Identity

```
Contact = Person
  └── Can exist in ONE CRM (crmId)
  └── Can OWN multiple CRMs (contactOwnerId relation)
  └── Can ACCESS multiple CRMs (company_memberships)
  └── Has ONE Firebase identity (firebaseUid)
```

### CompanyHQ is Multi-Purpose Container

```
CompanyHQ = Tenant
  └── Can be Ultra (no ultraTenantId)
  └── Can be Child (has ultraTenantId)
  └── Can be owned by Owner (ownerId)
  └── Can be owned by Contact (contactOwnerId) ⭐
```

### Firebase is Sacred Ground

```
firebaseUid = Universal Identity
  └── One per Contact (when activated)
  └── Bridges all systems
  └── Never duplicated
  └── Pre-seedable via admin SDK
```

### Membership is Multi-Tenant Access

```
company_memberships = Cross-Tenant Access
  └── One Contact can have multiple memberships
  └── Different roles in different tenants
  └── isPrimary determines default CRM
```

---

## 8. COMPARISON: CLIENT PORTAL vs CRM ACCESS

### Journey 1: Contact → Client Portal
**Purpose**: Client views their proposals/work  
**Identity**: Contact with `firebaseUid`  
**Access**: Single tenant (their CompanyHQ via `contactCompanyId`)  
**App**: `ignitebd-clientportal`  
**Entry**: Invite link → set password → login

### Journey 2: Contact → Owner → CRM Access ⭐
**Purpose**: Contact becomes tenant owner with their own CRM  
**Identity**: Same Contact, same `firebaseUid`  
**Access**: Multi-tenant (own CRM + original CRM)  
**App**: `ignitebd-crm` OR main IgniteBD  
**Entry**: Pre-seeded Firebase → login → context switcher

---

## 9. NEXT STEPS

### To Enable Full Contact-to-Owner Flow:

1. ✅ **Schema**: Already supports it (no changes needed)

2. 📝 **Create Pre-Seed Script**:
   - Location: `/scripts/seed-contact-with-crm.js`
   - Input: Contact details, parent CompanyHQ
   - Output: Contact + CompanyHQ + memberships + Firebase user

3. 📝 **Enhance Authentication**:
   - Check memberships on login
   - Route to primary CRM by default
   - Provide tenant switcher UI

4. 📝 **Update Promotion Service**:
   - Ensure it works with pre-seeded contacts
   - Handle edge cases (already has firebaseUid, etc.)

5. 📝 **Document Seeding Process**:
   - When to pre-seed vs on-demand promotion
   - How to handle invitation codes (not needed if pre-seeded)

---

## 10. CRITICAL WARNINGS

### ⚠️ DO NOT

- ❌ Create separate Contact records for same person
- ❌ Duplicate firebaseUid across Contacts
- ❌ Use email as sole identifier (use firebaseUid)
- ❌ Mix `owners.firebaseId` and `Contact.firebaseUid` for same person

### ✅ DO

- ✅ Always use firebaseUid as identity anchor
- ✅ Create company_memberships for all tenant access
- ✅ Set isPrimary correctly
- ✅ Update Contact.role when elevating
- ✅ Preserve Contact.crmId (history of where they originated)

---

## AUDIT SUMMARY

**Date**: December 2024  
**Status**: ✅ **ARCHITECTURE READY**  
**Confidence**: **HIGH**

The current Ignite schema fully supports:
- ✅ Contact-to-Owner elevation
- ✅ Single identity across contexts
- ✅ Multi-tenant access
- ✅ Hierarchical tenant structure (ultra)
- ✅ Pre-seeding capability

**No schema changes required.** Application-level implementation is the next step.

---

**END OF AUDIT**
