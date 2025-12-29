# Contact Multi-CompanyHQ Architecture Decision

**Date**: December 29, 2024  
**Status**: ✅ **CANON DECISION - IMPLEMENTED**  
**Context**: MVP1 vs MVP3 approach for handling contacts that exist across multiple CompanyHQs

---

## ✅ FINAL DECISION (CANON)

**Contacts are CompanyHQ-scoped CRM records.**
- Each CompanyHQ has its own contact records
- Duplicate emails across CompanyHQs are explicitly allowed
- `@@unique([email, crmId])` ensures one contact per email per CompanyHQ
- No junction tables, no global contacts, no cross-CompanyHQ sync

**This decision is final for MVP1.**

---

## 🎯 The Problem

**Scenario**: Contact "Andre Bhatia" exists in CompanyHQ-A (created by User A). User B in CompanyHQ-B wants to enrich/manage the same contact.

**Current State**:
- Contacts have a **unique email constraint** (`email @unique`)
- Contacts have a **single `crmId`** field (the "original" CompanyHQ that created them)
- When CompanyHQ-B tries to enrich a contact created by CompanyHQ-A, we hit issues

**The Core Question**: How do we allow multiple CompanyHQs to track/manage the same contact?

---

## 🔄 What We Just Started Building (Junction Table Approach)

### Schema Changes (IN PROGRESS)
```prisma
// Junction table: Tracks which CompanyHQs are managing/tracking which contacts
model contact_companyhqs {
  id          String    @id @default(uuid())
  contactId   String
  companyHQId String
  addedAt     DateTime  @default(now())
  addedById   String?   // User who added this contact to this CompanyHQ
  notes       String?   // Optional notes about why this CompanyHQ is tracking this contact
  contact     Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  company_hq  company_hqs @relation(fields: [companyHQId], references: [id], onDelete: Cascade)

  @@unique([contactId, companyHQId]) // Prevent duplicate associations
  @@index([contactId])
  @@index([companyHQId])
  @@index([addedAt])
  @@map("contact_companyhqs")
}
```

### Changes Made So Far:
1. ✅ Created `contact_companyhqs` junction table in schema
2. ✅ Added relations to `Contact` and `company_hqs` models
3. ✅ Started updating `/api/contacts/create` to create associations
4. ✅ Started updating `/api/contacts/enrich/save` (not complete)

### How This Approach Works:
- Contact keeps **one global record** (email remains unique)
- Junction table tracks **which CompanyHQs are tracking it**
- `crmId` stays as the "original" CompanyHQ
- Multiple CompanyHQs can associate with the same contact via junction table

---

## 💡 Proposed Solution: Allow Duplicate Contacts

### The Idea:
**Allow multiple contact rows with the same email, as long as they have different `ownerId` + `companyHQId` combinations.**

### Schema Changes Needed:
```prisma
model Contact {
  id        String   @id @default(uuid())
  crmId     String   // CompanyHQ ID
  ownerId   String?  // Owner ID (who created/owns this contact)
  email     String?  // REMOVE @unique constraint
  
  // ... rest of fields
  
  // NEW: Composite unique constraint
  @@unique([email, crmId, ownerId]) // Same email can exist if crmId or ownerId differ
  // OR simpler:
  @@unique([email, crmId]) // Same email allowed per CompanyHQ
}
```

### How This Works:
1. **Contact created in CompanyHQ-A by User A**: 
   - `email: "andre@example.com"`, `crmId: "companyhq-a"`, `ownerId: "user-a"`
   
2. **Contact created in CompanyHQ-B by User B** (same email):
   - `email: "andre@example.com"`, `crmId: "companyhq-b"`, `ownerId: "user-b"`
   - ✅ **Allowed** - different `crmId` + `ownerId`

3. **Same user tries to create same contact again in same CompanyHQ**:
   - ❌ **Blocked** - violates unique constraint

### Benefits:
- ✅ **Simple**: No junction table needed
- ✅ **Clean data model**: Each CompanyHQ has its own contact record
- ✅ **No migration complexity**: Can start allowing duplicates immediately
- ✅ **Clear ownership**: Each CompanyHQ "owns" their version of the contact
- ✅ **Independent enrichment**: Each CompanyHQ can enrich independently

### Trade-offs:
- ⚠️ **Data duplication**: Same contact info stored multiple times
- ⚠️ **No global contact view**: Can't easily see "all CompanyHQs tracking this contact"
- ⚠️ **Enrichment doesn't sync**: If CompanyHQ-A enriches, CompanyHQ-B's version doesn't update
- ⚠️ **Search complexity**: Need to search across all contacts user has access to

---

## 📋 MVP1 vs MVP3 Strategy

### MVP1 Approach (Current Plan):
**"This contact has already been claimed by another company. We are developing methods to better handle this in the future."**

- Simple UX message
- Allow duplicate contacts (different `crmId` + `ownerId`)
- Each CompanyHQ works with their own copy
- No complex association logic

### MVP3 Approach (Future):
- Junction table or more sophisticated association model
- Global contact deduplication
- Cross-CompanyHQ enrichment sync
- "This contact is also being tracked by..." features

---

## 🔧 Implementation Checklist

### If We Go With Duplicate Contacts Approach:

#### Schema Changes:
- [ ] Remove `@unique` from `Contact.email`
- [ ] Add composite unique constraint: `@@unique([email, crmId])` or `@@unique([email, crmId, ownerId])`
- [ ] Remove junction table `contact_companyhqs` (if we go with duplicates)
- [ ] Update relations in `Contact` and `company_hqs` models

#### API Route Updates:
- [ ] `/api/contacts/create` - Allow creation if `email + crmId` combo is new
- [ ] `/api/contacts/enrich/save` - Enrichment works on CompanyHQ's own contact record
- [ ] `/api/contacts/retrieve` - Query by `crmId` (already does this)
- [ ] `/api/contacts/hydrate` - Hydrate by `crmId` (already does this)

#### Frontend Updates:
- [ ] Show friendly message if contact exists in another CompanyHQ
- [ ] Allow proceeding with creation anyway (creates CompanyHQ's own copy)
- [ ] Update contact search/filtering to work with duplicates

#### Migration Strategy:
- [ ] Existing contacts keep their `crmId`
- [ ] New contacts can be created with same email + different `crmId`
- [ ] No data migration needed (just constraint changes)

---

## 🚦 Current State Summary

### What's Done:
1. ✅ Schema: Junction table `contact_companyhqs` added (but decision pending)
2. ✅ Relations: Added to `Contact` and `company_hqs` models
3. 🟡 API: Started updating `/api/contacts/create` (partial)
4. ❌ API: `/api/contacts/enrich/save` not updated yet
5. ❌ Queries: Not updated to use junction table

### What's Pending:
- [ ] **DECISION**: Junction table vs duplicate contacts?
- [ ] If duplicates: Remove junction table, update constraints
- [ ] If junction: Complete API updates, update queries
- [ ] MVP1 UX: Friendly "already claimed" message
- [ ] Testing: Both approaches need thorough testing

---

## 📝 Notes

- **User's Preference**: Allow duplicate contacts (remove email uniqueness, add composite constraint)
- **Rationale**: "Cleanest and most sane" for MVP1
- **Future**: MVP3 can introduce more sophisticated association/deduplication logic
- **Migration Path**: Simpler if we allow duplicates (just constraint changes)

---

## 🔗 Related Files

- `/prisma/schema.prisma` - Schema changes
- `/app/api/contacts/create/route.js` - Contact creation logic
- `/app/api/contacts/enrich/save/route.ts` - Enrichment save logic
- `/app/api/contacts/retrieve/route.js` - Contact retrieval logic
- `/app/api/contacts/hydrate/route.js` - Contact hydration logic

---

## ❓ Questions to Resolve

1. **Unique Constraint**: `@@unique([email, crmId])` or `@@unique([email, crmId, ownerId])`?
   - If `ownerId` is included, same CompanyHQ can have multiple versions per owner
   - If not, same CompanyHQ can only have one version per email

2. **Junction Table**: Keep it for MVP3 or remove entirely?

3. **Enrichment Sync**: Should we attempt any sync in MVP1, or strictly separate?

4. **Search/Dedupe**: Do we need any deduplication logic in MVP1, or fully separate?

---

**Status**: 🟡 **AWAITING DECISION AFTER REVIEW**

