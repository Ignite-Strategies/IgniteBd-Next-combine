# Microsoft Route Architecture Decision

## Current Patterns

### Contact-Scoped (Domain Entity)
- `/contacts/enrich/linkedin` - LinkedIn enrichment
- `/contacts/enrich/microsoft` - Microsoft enrichment (existing)
- `/contacts/enrich/csv` - CSV enrichment
- `/contacts/upload` - Contact upload
- `/contacts/view` - View contacts

**Pattern:** `/contacts/{action}/{source}`

### Integration-Scoped (Settings)
- `/settings/integrations` - Microsoft OAuth connection
- No `/microsoft/` route structure exists

**Pattern:** `/settings/integrations` (all integrations together)

### API Routes
- `/api/microsoft/*` - Microsoft OAuth/auth
- `/api/microsoft-graph/*` - Microsoft Graph API
- `/api/contacts/*` - Contact CRUD

---

## Options for Contact Hydration

### Option A: Contact-Scoped (Current)
**Route:** `/contacts/ingest/microsoft`

**Pros:**
- ✅ Matches existing pattern (`/contacts/enrich/microsoft`)
- ✅ Contact is the domain entity
- ✅ All contact operations in one place
- ✅ Consistent with other sources (LinkedIn, CSV)

**Cons:**
- ❌ Microsoft is the integration, not a contact feature
- ❌ If Microsoft has other features, they'd be scattered
- ❌ Mixes domain (contacts) with integration (Microsoft)

---

### Option B: Microsoft-Scoped (Integration)
**Route:** `/microsoft/contacts` or `/microsoft/ingest`

**Pros:**
- ✅ Microsoft is the integration/source
- ✅ All Microsoft features in one place
- ✅ Clear separation: integration vs domain
- ✅ Future Microsoft features can live here

**Cons:**
- ❌ Breaks existing pattern (enrichment is contact-scoped)
- ❌ Would need new `/microsoft/` route structure
- ❌ Inconsistent with `/contacts/enrich/microsoft`

---

### Option C: Hybrid (Settings + Action)
**Route:** `/settings/integrations/microsoft/contacts`

**Pros:**
- ✅ Microsoft features grouped under integrations
- ✅ Clear it's an integration feature

**Cons:**
- ❌ Settings page is for configuration, not actions
- ❌ Deep nesting
- ❌ Less discoverable

---

## Architecture Principles

### Domain-Driven vs Integration-Driven

**Contact-Scoped (Domain-Driven):**
- Contacts are the domain entity
- Microsoft is just one source among many
- Pattern: "I want to work with contacts, and Microsoft is how I get them"

**Microsoft-Scoped (Integration-Driven):**
- Microsoft is the integration
- Contacts are what Microsoft provides
- Pattern: "I want to use Microsoft, and contacts are what I get"

---

## Recommendation

**Option A: Contact-Scoped** (`/contacts/ingest/microsoft`)

**Rationale:**
1. **Consistency:** Matches existing `/contacts/enrich/microsoft` pattern
2. **User Mental Model:** Users think "I need contacts" not "I need Microsoft"
3. **Discoverability:** Users looking for contacts will find it in contacts hub
4. **Domain Alignment:** Contact hydration is a contact operation, Microsoft is just the source

**However, consider:**
- If Microsoft becomes a major integration with many features (email, calendar, contacts, etc.), then Option B makes sense
- For now, Microsoft is just a contact source, so contact-scoped is appropriate

---

## Alternative: Simplify Route

**Option D: Simplified Contact-Scoped**
**Route:** `/contacts/microsoft`

**Pros:**
- ✅ Simpler than `/contacts/ingest/microsoft`
- ✅ Still contact-scoped
- ✅ Matches `/contacts/enrich` pattern (no sub-path for action)

**Cons:**
- ❌ Less specific about what it does (ingest vs enrich vs view)

---

## Decision Matrix

| Option | Route | Consistency | Clarity | Future-Proof |
|--------|-------|-------------|---------|--------------|
| A | `/contacts/ingest/microsoft` | ✅ Matches enrich | ✅ Clear action | ⚠️ If Microsoft grows |
| B | `/microsoft/contacts` | ❌ Breaks pattern | ✅ Clear source | ✅ Scalable |
| C | `/settings/integrations/microsoft/contacts` | ❌ Different pattern | ⚠️ Settings = config | ⚠️ Deep nesting |
| D | `/contacts/microsoft` | ✅ Matches enrich | ⚠️ Less specific | ⚠️ If Microsoft grows |

---

## Question for Decision

**Is Microsoft:**
1. **A contact source** (like LinkedIn, CSV) → Contact-scoped ✅
2. **A major integration** (with email, calendar, contacts, etc.) → Microsoft-scoped ✅

**Current evidence:**
- Microsoft has OAuth connection (integration)
- Microsoft has contact enrichment (contact-scoped)
- Microsoft has email sending (out of scope for hydration)
- Microsoft has calendar (out of scope for hydration)

**Verdict:** Microsoft is currently **a contact source**, so contact-scoped makes sense. But if it becomes a major integration hub, Microsoft-scoped would be better.

