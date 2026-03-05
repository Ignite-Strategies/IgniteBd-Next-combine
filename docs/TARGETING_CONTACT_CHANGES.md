# Targeting: Freeze Frame — What Changes on Contact

Only **one new field** (and one new enum) touch the Contact model. Everything else stays as-is.

---

## Contact model today (unchanged)

All of these stay exactly as they are:

| Field | Type | Notes |
|-------|------|--------|
| id | String | @id @default(cuid()) |
| crmId | String | |
| firstName, lastName, fullName, goesBy | String? | |
| email, phone | String? | |
| title, seniority, department | String? | |
| linkedinUrl, linkedinConnectedOn | String? | |
| city, state, country | String? | |
| companyName, companyDomain | String? | |
| positionType, contactCompanyId | String? | |
| howMet | String? | |
| **notes** | String? | *(already used for targeting context)* |
| contactListId | String? | |
| domain | String? | |
| enrichmentSource, enrichmentFetchedAt, enrichmentPayload | String? / DateTime? / Json? | |
| createdById, firebaseUid | String? | |
| clientPortalUrl | String? | |
| isActivated, activatedAt | DateTime? | |
| ownerId | String? | |
| role | String | @default("contact") |
| createdAt, updatedAt | DateTime | |
| (all scoring / BI fields) | various | buyerLikelihoodScore, careerMomentum, etc. |
| buyingReadiness, buyerPerson | enum? | |
| introducedByContactId | String? | |
| **persona_type** | PersonaType? | *(already there)* |
| **prior_relationship** | RelationshipEnum? | *(already there — COLD/WARM/ESTABLISHED/DORMANT)* |
| lastContact, remindMeOn | String? / DateTime? | |
| lastContactedAt, lastRespondedAt, nextContactedAt | DateTime? | |
| nextContactNote | String? | |
| doNotContactAgain | Boolean | @default(false) |
| nextEngagementDate | String? | |
| nextEngagementPurpose | NextEngagementPurpose? | |
| contactDisposition | ContactDisposition? | |
| **pipelineSnap** | String? | *(unchanged — still from pipelines)* |
| **pipelineStageSnap** | String? | *(unchanged)* |
| outreachPersonaSlug | String? | |
| relationship_contexts | relation | |

All relations (company_hqs, companies, contact_lists, pipelines, outreach_personas, etc.) — **unchanged**.

All existing indexes — **unchanged**.

---

## What actually changes on Contact

### 1. New enum (in schema, not on Contact yet)

```prisma
enum ContactOutreachIntent {
  PROSPECT   // Default: in pool, not queued for "next cadence"
  TARGET     // Explicitly marked for next cadence run
}
```

### 2. One new field on Contact

```prisma
// On Contact, add with the other outreach/outreach-intent fields (e.g. after outreachPersonaSlug or prior_relationship):
outreachIntent   ContactOutreachIntent?   @default(PROSPECT)
```

- **Optional.** Null or PROSPECT = normal behavior (current). TARGET = "in the Targeting list; queued for next cadence."
- **Default PROSPECT** so existing rows and new CSV rows without a "target" column behave as today.

### 3. One new index (for "show all targets" queries)

```prisma
@@index([outreachIntent])
```

So `where: { crmId, outreachIntent: 'TARGET' }` is cheap.

---

## Nothing else on Contact changes

- No renames, no type changes, no removals.
- **notes**, **prior_relationship**, **persona_type**, **pipelineSnap**, **pipelineStageSnap** stay as-is and are what we use for "who they are / my relationship / pipeline stage."
- **Targeting** = filter by `outreachIntent = TARGET`; "send initial" clears it to PROSPECT (or leaves PROSPECT) so they drop off the Targeting list and live in the pipeline only.

---

## Optional (not in minimal change)

- **targetedAt** DateTime? — if you want to record when someone was first marked as target or when they were "sent initial." Not required for the minimal flow.

---

## Summary

| What | Change |
|------|--------|
| Contact fields | **+1**: `outreachIntent ContactOutreachIntent? @default(PROSPECT)` |
| Contact indexes | **+1**: `@@index([outreachIntent])` |
| Schema enums | **+1**: `ContactOutreachIntent { PROSPECT, TARGET }` |
| Everything else on Contact | **Unchanged** |
