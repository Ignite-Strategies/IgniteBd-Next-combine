# Snippet Uniqueness & Hydration API

## Uniqueness Model

**Current:** Snippets are **company-scoped** (unique per company)
- Unique constraint: `@@unique([companyHQId, snipName])`
- This means: Same snippet name can exist in different companies
- Example: Company A can have `opening_reconnect` and Company B can also have `opening_reconnect`

**Why company-scoped makes sense:**
- Each company has their own language/style
- Same snippet name might have different text per company
- No conflicts between companies
- Companies can share snippet names without issues

**If you need global uniqueness:**
- Would require removing companyHQId from unique constraint
- Would need to add global namespace or prefix
- Not recommended unless you have a specific use case

## Hydration API

**Endpoint:** `GET /api/outreach/content-snips/hydrate?companyHQId=xxx`

**Returns:** All active snippets for a company in a hydrated format optimized for template resolution

**Response Format:**
```json
{
  "success": true,
  "companyHQId": "xxx",
  "count": 19,
  "snippets": {
    "opening_reconnect_prior_conversation": {
      "snipText": "Following up on our conversation about {{topic}}...",
      "snipType": "opening",
      "relationshipContextId": "xxx",
      "relationshipContext": {
        "contextKey": "PRIOR_CONVERSATION_RECENT_KNOWS_COMPANY",
        "contextOfRelationship": "PRIOR_CONVERSATION",
        "relationshipRecency": "RECENT",
        "companyAwareness": "KNOWS_COMPANY"
      }
    },
    "cta_brief_call": {
      "snipText": "Please let me know if a brief call would be worthwhile.",
      "snipType": "cta",
      "relationshipContextId": null,
      "relationshipContext": null
    }
  },
  "byType": {
    "opening": ["opening_reconnect_prior_conversation", "..."],
    "cta": ["cta_brief_call", "..."],
    "subject": ["subject_nda_checkin", "..."]
  }
}
```

**Use Cases:**
- Template resolution: Quick lookup by snipName
- AI template builder: Get all snippets in one call
- Template preview: Hydrate all snippets before rendering
- Bulk operations: Process all snippets efficiently

**Benefits:**
- Single API call gets everything
- Pre-formatted for template resolution
- Includes relationship context info
- Grouped by type for easy filtering
