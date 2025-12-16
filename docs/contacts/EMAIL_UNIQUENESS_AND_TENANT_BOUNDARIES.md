# Email Uniqueness and Tenant Boundaries

## Overview

The `email` field on the `Contact` model is **globally unique** (`@unique` in Prisma schema). This means:
- **One email = One contact globally** (across all tenants)
- You cannot have the same email in different tenants
- Email is the primary identifier for contact lookups

## Current Implementation (MVP1)

### Contact Lookup Strategy

**Always use `findUnique` for email lookups:**

```javascript
// ✅ CORRECT - Use findUnique since email is globally unique
const contact = await prisma.contact.findUnique({
  where: { email: normalizedEmail }
});

// ❌ WRONG - Don't use findFirst with crmId + email
// This is redundant and doesn't leverage the unique index
const contact = await prisma.contact.findFirst({
  where: {
    crmId: companyHQId,  // Redundant - email is already unique globally
    email: normalizedEmail
  }
});
```

### Why `findUnique`?

1. **Performance**: Uses the unique index directly (O(1) lookup)
2. **Correctness**: Matches the database constraint
3. **Simplicity**: One field lookup instead of multiple conditions

### Tenant Boundary Handling

**Current behavior:**
- If email exists in a different tenant → Log warning, skip/error
- If email exists in same tenant → Update existing contact
- If email doesn't exist → Create new contact

**Example from batch route:**
```javascript
const existingContact = await prisma.contact.findUnique({
  where: { email: normalizedEmail }
});

if (existingContact) {
  // Verify it's in the same tenant
  if (existingContact.crmId !== companyHQId) {
    // Email exists in different tenant - can't create duplicate
    results.errors.push(`Email ${normalizedEmail} already exists in another tenant`);
    continue; // Skip this row
  }
  // Update existing contact in same tenant
} else {
  // Create new contact
}
```

## Future Considerations (MVP2)

### Potential Tenant Boundary Features

**Option 1: Contact Sharing Across Tenants**
- Allow contacts to exist in multiple tenants
- Use a junction table (`ContactTenantMembership`)
- Remove global `@unique` constraint on email
- Each tenant has their own view/relationship with the contact

**Option 2: Contact Transfer/Migration**
- Allow moving contacts between tenants
- Audit trail of tenant changes
- Permission system for transfers

**Option 3: Global Contact Registry**
- Contacts are global entities
- Tenants "subscribe" to contacts
- Contact data is shared, but tenant-specific fields (notes, pipeline) are separate

### Schema Changes for MVP2

If implementing tenant sharing:

```prisma
// Remove global unique constraint
model Contact {
  email String?  // No longer @unique globally
  // ... other fields
}

// Add junction table
model ContactTenantMembership {
  id        String   @id @default(uuid())
  contactId String
  tenantId  String   // companyHQId
  role      String?  // "owner", "shared", etc.
  createdAt DateTime @default(now())
  
  contact Contact @relation(fields: [contactId], references: [id])
  tenant  CompanyHQ @relation(fields: [tenantId], references: [id])
  
  @@unique([contactId, tenantId])
}
```

## Current Code Patterns

### ✅ Correct Pattern (Contact Creation)

```javascript
// 1. Normalize email
const normalizedEmail = email.toLowerCase().trim();

// 2. Use findUnique (not findFirst)
let existingContact = null;
try {
  existingContact = await prisma.contact.findUnique({
    where: { email: normalizedEmail }
  });
} catch (error) {
  // findUnique throws P2025 if not found - that's fine
  if (error.code !== 'P2025') throw error;
}

// 3. Handle tenant boundary
if (existingContact) {
  if (existingContact.crmId !== companyHQId) {
    // Different tenant - handle conflict
    throw new Error('Email exists in different tenant');
  }
  // Update existing
} else {
  // Create new
}
```

### ✅ Correct Pattern (Contact Upsert)

```javascript
// Use upsert directly - Prisma handles uniqueness
const contact = await prisma.contact.upsert({
  where: { email: normalizedEmail },
  update: { /* update fields */ },
  create: { 
    crmId: companyHQId,
    email: normalizedEmail,
    /* other fields */
  }
});
```

## Key Takeaways

1. **Email is globally unique** - One email = One contact (across all tenants)
2. **Always use `findUnique`** for email lookups (not `findFirst`)
3. **Tenant boundaries are enforced** - Can't create duplicate emails even in different tenants
4. **MVP2 consideration**: May need to change this if contact sharing is required
5. **Performance**: `findUnique` is faster because it uses the unique index

## Related Files

- `/src/app/api/contacts/batch/route.js` - Batch contact creation with tenant boundary checks
- `/src/app/api/contacts/create/route.js` - Single contact creation using upsert
- `/src/lib/services/contactService.ts` - Contact service with domain inference
- `/prisma/schema.prisma` - Contact model definition (line 274: `email String? @unique`)
