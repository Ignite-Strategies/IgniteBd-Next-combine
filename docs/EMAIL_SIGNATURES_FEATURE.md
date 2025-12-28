# Email Signatures Feature - Implementation Plan

## Status: 🔴 Not Implemented (Commented Out)

This feature is **fully commented out** in the codebase to allow 1:1 outreach testing. All signature-related code is disabled but marked with TODO comments for future implementation.

## Overview

Email signatures allow users to create reusable HTML signatures that can be:
- Assigned to campaigns
- Used in email sequence steps
- Selected in 1:1 outreach compose

## Database Schema

### Planned Model: `email_signatures`

```prisma
model email_signatures {
  id                String            @id @default(uuid())
  owner_id          String            // Owner who created this signature
  name              String            // Display name (e.g., "Default", "Sales Team", "Support")
  content           String            // HTML signature content
  is_default        Boolean           @default(false) // Default signature for this owner
  created_at        DateTime          @default(now())
  updated_at        DateTime          @updatedAt
  owners            owners            @relation(fields: [owner_id], references: [id], onDelete: Cascade)
  campaigns         campaigns[]       @relation("campaign_signatures")
  sequence_steps    sequence_steps[]  @relation("sequence_step_signatures")

  @@index([owner_id])
  @@index([owner_id, is_default])
}
```

### Planned Relations

1. **campaigns** table:
   - `signature_id String?` (foreign key to email_signatures)
   - `email_signatures?` relation

2. **sequence_steps** table:
   - `signature_id String?` (foreign key to email_signatures)
   - `email_signatures?` relation

3. **owners** table:
   - `email_signatures[]` relation (one-to-many)

## Migration File

**Location:** `prisma/migrations/20250130000000_create_email_signatures_relational/migration.sql`

**Status:** ✅ Ready but not applied

This migration will:
- Create `email_signatures` table
- Add `signature_id` fields to `campaigns` and `sequence_steps`
- Add foreign key constraints
- Create indexes for performance

## Current State

### Schema Status
- ❌ `email_signatures` model: **Commented out** (doesn't exist in schema)
- ❌ `campaigns.signature_id`: **Commented out**
- ❌ `sequence_steps.signature_id`: **Commented out**
- ❌ All signature relations: **Commented out**

### Code Status
- ❌ Settings page signature UI: **Commented out**
- ❌ Compose page signature checkbox: **Commented out**
- ❌ Profile API signature handling: **Commented out**
- ❌ Signature state/loading logic: **Commented out**

## Implementation Steps (Future)

1. **Uncomment schema** - Add `email_signatures` model and relations
2. **Run migration** - Apply `20250130000000_create_email_signatures_relational/migration.sql`
3. **Create API routes**:
   - `POST /api/email-signatures` - Create signature
   - `GET /api/email-signatures?ownerId=xxx` - List owner's signatures
   - `PUT /api/email-signatures/[id]` - Update signature
   - `DELETE /api/email-signatures/[id]` - Delete signature
4. **Update Settings page** - Uncomment and refactor to use relational model
5. **Update Compose page** - Uncomment and add signature selector
6. **Update Campaigns** - Add signature selector to campaign creation/editing
7. **Update Sequences** - Add signature selector to sequence steps

## Files to Update (When Re-enabling)

1. `prisma/schema.prisma` - Uncomment email_signatures model and relations
2. `app/(authenticated)/settings/page.jsx` - Uncomment signature UI
3. `app/(authenticated)/outreach/compose/page.jsx` - Uncomment signature logic
4. `app/api/owner/[ownerId]/profile/route.js` - Remove signature handling (will use separate API)

## Testing Checklist (Future)

- [ ] Create signature in Settings
- [ ] Set default signature
- [ ] Select signature in 1:1 compose
- [ ] Signature appears in preview
- [ ] Signature included in sent email
- [ ] Assign signature to campaign
- [ ] Assign signature to sequence step
- [ ] Multiple signatures per owner
- [ ] Delete signature (handle campaigns using it)

## Notes

- Signatures are **HTML** (allows formatting with `<p>`, `<br>`, etc.)
- Each owner can have **multiple signatures**
- One signature can be marked as **default**
- Signatures are **reusable** across campaigns and sequences
- Migration uses `IF NOT EXISTS` / `IF EXISTS` for safe application

