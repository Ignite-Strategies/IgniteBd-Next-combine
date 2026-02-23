# Pipeline investigation (CSV upload default + normalizer)

**Purpose:** Single source for pipeline/stage used in CSV batch upload: first step = “awaiting outreach”, plus value normalizer for close-but-wrong CSV values.

---

## Canonical values (from `lib/config/pipelineConfig.js`)

**Pipelines:** `unassigned` | `prospect` | `client` | `collaborator` | `institution`

**Prospect stages (first = “awaiting outreach”):**
1. `need-to-engage` — Contact in CRM but hasn’t been emailed yet (**use as default for new CSV uploads**)
2. `interest`
3. `meeting`
4. `proposal`
5. `contract`
6. `contract-signed`

**Client stages:** kickoff, work-started, work-delivered, sustainment, renewal, terminated-contract  
**Collaborator/Institution stages:** interest, meeting, moa, agreement

---

## Default for CSV upload when no Pipeline/Stage column

- **Pipeline:** `prospect`
- **Stage:** `need-to-engage` (first step = “awaiting outreach”)

So new contacts from CSV get pipeline `prospect` and stage `need-to-engage` unless the CSV provides pipeline/stage.

---

## Value normalizer (CSV → canonical)

CSV may have human-friendly or inconsistent values. Map them to the slugs above:

**Pipeline normalizer (input → canonical):**
- "prospect", "Prospect", "Prospects" → `prospect`
- "client", "Client", "Clients" → `client`
- "collaborator", "Collaborator", "Collaborators" → `collaborator`
- "institution", "Institution", "Institutions" → `institution`
- "unassigned", "Unassigned", "none", "—" → `unassigned`

**Stage normalizer (prospect) – “close” variants:**
- "need-to-engage", "need to engage", "Need to Engage", "awaiting outreach", "Awaiting Outreach", "not contacted", "to contact" → `need-to-engage`
- "interest", "Interest", "interested" → `interest`
- "meeting", "Meeting", "meeting scheduled" → `meeting`
- "proposal", "Proposal" → `proposal`
- "contract", "Contract" → `contract`
- "contract-signed", "contract signed", "Contract Signed", "signed" → `contract-signed`

Normalizer: trim, lowercase, then lookup; if no match, pass through (validation in pipelineService will catch invalid values).

---

## Batch route usage

1. After building `normalizedRow`, run pipeline and stage through the normalizer.
2. If CSV has no pipeline/stage (or empty), use default `prospect` / `need-to-engage`.
3. Call `ensureContactPipeline(contact.id, { pipeline, stage })` with normalized or default values.
