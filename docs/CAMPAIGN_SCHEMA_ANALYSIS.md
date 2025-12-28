# Campaign Schema Analysis

## Current Schema Baseline

### `campaigns` Model

```prisma
model campaigns {
  // Identity & Ownership
  id               String             @id @default(uuid())
  owner_id         String
  company_hq_id    String?
  
  // Basic Info
  name             String
  description      String?
  
  // State Management
  status           CampaignStatus     @default(DRAFT)  // DRAFT, SCHEDULED, ACTIVE, PAUSED, COMPLETED, CANCELLED
  type             CampaignType       @default(EMAIL)  // EMAIL, SEQUENCE, ONE_OFF
  
  // Bolt-ons (Master Container Pattern)
  contact_list_id  String?           // WHO - Contact list (reusable, modular)
  template_id      String?           // WHAT - Email template (optional - can be manual or from template)
  
  // Direct Email Content (REDUNDANT when template_id exists)
  subject          String?
  preview_text     String?
  body             String?            // Email body content
  from_email       String?
  from_name        String?
  
  // Timestamps (can infer status from these)
  scheduled_for    DateTime?
  started_at       DateTime?
  completed_at     DateTime?
  
  // Metrics (calculated/aggregated)
  total_recipients Int                @default(0)
  emails_sent      Int                @default(0)
  emails_delivered Int                @default(0)
  emails_opened    Int                @default(0)
  emails_clicked   Int                @default(0)
  emails_replied   Int                @default(0)
  emails_bounced   Int                @default(0)
  open_rate        Float?
  click_rate       Float?
  reply_rate       Float?
  bounce_rate      Float?
  
  // System
  created_at       DateTime           @default(now())
  updated_at       DateTime           @updatedAt
}
```

## Redundancy Analysis

### 1. **Email Content Fields (REDUNDANT when template_id exists)**

**Current:** Campaigns have both:
- `template_id` (optional) - points to template
- Direct fields: `subject`, `body`, `preview_text`, `from_email`, `from_name`

**Issue:** When `template_id` is set, the direct fields duplicate template content. Template should be source of truth.

**Simplification Options:**
- **Option A (Recommended):** Keep direct fields but treat as "overrides" - only used when `template_id` is null
  - When `template_id` exists → use template content (ignore direct fields)
  - When `template_id` is null → use direct fields
  - This is what we're doing now with inference - no schema change needed!

- **Option B (More radical):** Remove direct fields entirely, always require template
  - ❌ Less flexible - can't create quick manual campaigns

### 2. **Status Field (CAN BE INFERRED)**

**Current:** `status` enum with manual management

**Inference Rules:**
- `completed_at` exists → COMPLETED
- `started_at` exists && !`completed_at` → ACTIVE
- `scheduled_for` exists && future → SCHEDULED
- `status === 'PAUSED'` → stays PAUSED (explicit state)
- `status === 'CANCELLED'` → stays CANCELLED (explicit state)
- Default → DRAFT

**Simplification Options:**
- **Option A (Recommended):** Keep `status` field but auto-infer/update via application logic
  - Application infers suggested status
  - User/system can still explicitly set status (PAUSED, CANCELLED)
  - No schema change needed!

- **Option B:** Remove `status`, compute from timestamps only
  - ❌ Can't represent PAUSED or CANCELLED states clearly

### 3. **Type Field (CAN BE INFERRED)**

**Current:** `type` enum (EMAIL, SEQUENCE, ONE_OFF)

**Inference Rules:**
- If `email_sequences` relation has items → SEQUENCE
- If `template_id` exists or direct content exists → EMAIL
- If `type === 'ONE_OFF'` → explicit ONE_OFF

**Simplification Options:**
- **Option A (Recommended):** Keep `type` but auto-set based on whether sequences exist
  - Provides explicit intent
  - Can be computed from relations but explicit is clearer

- **Option B:** Remove `type`, compute from `email_sequences` relation
  - ❌ Less clear, requires joins to determine type

## Recommended Simplifications (No Schema Changes)

Since the schema is already well-designed with the master container pattern, we can simplify via **application logic** rather than schema changes:

### 1. **Smart Content Resolution**
- When `template_id` exists → template is source of truth
- When `template_id` is null → use direct fields (`subject`, `body`)
- Application layer handles this (already implemented in inference service)

### 2. **Status Inference**
- Infer suggested status from timestamps
- Allow explicit overrides (PAUSED, CANCELLED)
- Auto-progress when appropriate (DRAFT → SCHEDULED → ACTIVE)

### 3. **Type Inference**
- Keep `type` field (explicit is good)
- Optionally auto-set based on sequences, but manual override allowed

## Fields That Could Be Removed (Future Consideration)

If we want to be more radical:

1. **`subject`, `body` when template_id exists**
   - Could be computed/joined from template
   - But keeping them allows for "template with overrides" pattern
   - **Recommendation:** Keep them, just don't use when template_id exists

2. **`status` field**
   - Could be computed from timestamps
   - But explicit status (PAUSED, CANCELLED) is valuable
   - **Recommendation:** Keep it, use inference to suggest but allow overrides

3. **`type` field**
   - Could be inferred from email_sequences relation
   - But explicit type is clearer than joins
   - **Recommendation:** Keep it

## Current Usage Analysis

From codebase search:
- `type` field is set on creation (defaults to 'EMAIL') but not heavily used in logic
- Mostly just displayed in UI (`campaign.type || 'Email Campaign'`)
- No complex routing based on type - it's more of a label

## Conclusion

**The schema is already well-designed!** No schema changes needed. The simplification should happen at the **application logic layer**:

1. ✅ **Template as source of truth** - Already handled via inference service
2. ✅ **Status inference** - Already implemented  
3. ✅ **Smart routing** - Already in place

The current schema follows the master container pattern correctly:
- Campaigns are containers with bolt-ons (`template_id`, `contact_list_id`)
- The "redundancy" (template_id + direct fields) is intentional flexibility
- Application layer correctly prioritizes template when present

## Recommended Action Plan

### ✅ Already Done (Application Layer)
1. Created `campaignInference.js` service for smart state inference
2. Template precedence logic (template_id takes priority)
3. Status inference from timestamps
4. Smart routing in edit page (template mode vs manual mode)

### 🔍 What We Learned
- **No schema changes needed** - the baseline is solid
- The fields that seem "redundant" (subject/body when template_id exists) are intentional
- They provide flexibility: template OR manual, not template AND manual
- Application logic correctly handles the precedence (template wins)

### 📝 Next Steps (Optional Enhancements)
1. **Remove `type` field?** - Currently only used for display, could be inferred from email_sequences relation
   - Keep it if explicit intent is valuable
   - Remove if we want to infer from relations only

2. **Consider computed fields** - Could make `status` a computed field, but explicit enum is clearer
   - Keep it - explicit state is better than computed

3. **Document the pattern** - Make it clear that template_id is source of truth when present
   - ✅ Already documented in inference service

**Bottom line:** Schema is good. Application logic handles the complexity correctly. No refactoring needed!

