# Campaign companyHQId Pattern

## Overview

Campaigns follow the same pattern as Templates: `owner_id` is required (from auth), `company_hq_id` is optional (can be added later as bolt-on).

## Pattern Comparison

### Templates (`/api/templates`)
- `ownerId`: Required from request body (from `useOwner` hook)
- `companyHQId`: Optional (not in schema, can be added later)

### Campaigns (`/api/campaigns`)
- `owner_id`: Required from Firebase auth
- `company_hq_id`: Optional from request body (can be `null`, matches template pattern)

### Contact Lists (`/api/contact-lists`)
- `companyHQId`: Required (because `contact_lists` table has `companyId` as required field)
- Different pattern - contact lists are company-scoped, campaigns/templates are owner-scoped

## Implementation

### Schema
```prisma
model campaigns {
  owner_id         String      // Required - from auth
  company_hq_id    String?     // Optional - can be added later as bolt-on
  // ...
}
```

### POST `/api/campaigns`
- Gets `owner_id` from Firebase auth (required)
- Gets `company_hq_id` from request body (optional, defaults to `null`)
- No validation error if `company_hq_id` is missing

### GET `/api/campaigns`
- Filters by `owner_id` (required - from auth)
- Optionally filters by `company_hq_id` if provided as query param
- Follows contact-lists pattern for query params

### Frontend Create Page
- Doesn't wait for `companyHQId` before creating campaign
- Sends `company_hq_id` if available, but doesn't require it
- Campaign can be created with just `owner_id`, `company_hq_id` can be added later

## Benefits

1. **Flexibility**: Campaigns can be created immediately without requiring companyHQ setup
2. **Consistency**: Matches template pattern (owner-scoped, company optional)
3. **Bolt-on Pattern**: `company_hq_id` is truly optional, can be added later when needed
4. **No Blocking**: Frontend doesn't block on companyHQId availability

