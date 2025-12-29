# Enrichment Save Route Audit

## Overview
This document audits what data is extracted from Apollo and what is saved to the database.

## Apollo Response Structure

### Person Object Fields (from Apollo API)
```typescript
person: {
  // Basic
  id, first_name, last_name, name, email, 
  phone_numbers[], linkedin_url, photo_url,
  
  // Professional
  title, seniority, department,
  
  // Location
  city, state, country,
  
  // Organization
  organization: {
    name, website_url, primary_domain,
    employees, estimated_num_employees,
    annual_revenue, revenue_range,
    growth_rate, industry,
    funding_events[]
  },
  
  // Employment History
  employment_history[]: {
    started_at, ended_at, title,
    organization: { name }
  }
}
```

## What We Extract (normalizeContactApollo)

### ✅ Extracted Fields
- **Basic**: fullName, firstName, lastName, email, phone, linkedinUrl
- **Professional**: title, seniority, department, jobRole
- **Location**: city, state, country, timezone (not extracted - missing!)
- **Career Signals**: 
  - currentRoleStartDate ✅
  - totalYearsExperience ✅
  - numberOfJobChanges ✅
  - averageTenureMonths ✅
  - careerProgression ✅
  - recentJobChange ✅
  - recentPromotion ❌ (not extracted)
- **Company Context**: companyName, companyDomain, companySize, companyIndustry

### ❌ Missing from Extraction
- `photo_url` / `avatarUrl` - Not extracted
- `timezone` - Comment says "would need to be inferred" but never done
- `recentPromotion` - Calculated in normalizeContactApollo but logic might be missing

## What We Compute (Intelligence Scores)

### ✅ Computed Scores
- seniorityScore
- buyingPowerScore
- urgencyScore
- rolePowerScore
- buyerLikelihoodScore
- readinessToBuyScore
- careerMomentumScore
- careerStabilityScore

### ✅ Inference Fields
- profileSummary (GPT-generated)
- tenureYears (deprecated, use currentTenureYears)
- currentTenureYears
- totalExperienceYears
- avgTenureYears
- careerTimeline

## What We Save to Database (contactUpdateData)

### ✅ Saved Fields

#### Enrichment Metadata
- enrichmentSource ✅
- enrichmentFetchedAt ✅
- enrichmentPayload ✅ (NEW - now always saved)
- enrichmentRedisKey ✅

#### Intelligence Scores (if not skipIntelligence)
- seniorityScore ✅
- buyingPowerScore ✅
- urgencyScore ✅
- rolePowerScore ✅
- buyerLikelihoodScore ✅
- readinessToBuyScore ✅
- careerMomentumScore ✅
- careerStabilityScore ✅

#### Inference Fields (if not skipIntelligence)
- profileSummary ✅
- tenureYears ✅
- currentTenureYears ✅
- totalExperienceYears ✅
- avgTenureYears ✅
- careerTimeline ✅

#### Normalized Contact Fields
- title ✅
- seniority ✅
- department ✅
- jobRole ✅
- linkedinUrl ✅
- city ✅
- state ✅
- country ✅
- timezone ❌ (not in contactUpdateData!)

#### Career Signals
- currentRoleStartDate ✅
- totalYearsExperience ✅
- numberOfJobChanges ✅
- averageTenureMonths ✅
- careerProgression ✅
- recentJobChange ✅
- recentPromotion ❌ (not in contactUpdateData!)

#### Company Context (convenience copies)
- companyName ✅
- companyDomain ✅
- companySize ✅
- companyIndustry ✅

#### Name/Email Updates (conditional)
- email ✅ (if different)
- phone ✅ (if provided)
- fullName ✅ (if provided)
- firstName ✅ (if provided)
- lastName ✅ (if provided)
- domain ✅ (if not set)

## ✅ Fields in Save Route (Verified)

### Already Saved (Good!)
- timezone ✅ (line 357 in save route)
- recentPromotion ✅ (line 366 in save route)

## ❌ Missing Fields

### From Apollo (available but not extracted)
1. **photo_url** / **avatarUrl** - Available in Apollo `person.photo_url` but:
   - ❌ Not extracted in normalizeContactApollo
   - ❌ Not saved in save route
   - ❌ Not in Contact schema (would need to add field)

### From normalizeContactApollo (extracted but might be undefined)
1. **timezone** - Field exists in save route but normalizeContactApollo doesn't extract it (comment says "would need to be inferred")
2. **recentPromotion** - Field exists in save route but normalizeContactApollo doesn't calculate it (only careerProgression is calculated)

## Field Mapping Verification

### Contact Schema Fields vs What We Save

| Schema Field | Extracted? | Saved? | Notes |
|-------------|------------|--------|-------|
| enrichmentSource | ✅ | ✅ | Always "Apollo" |
| enrichmentFetchedAt | ✅ | ✅ | Current timestamp |
| enrichmentPayload | ✅ | ✅ | NEW - now always saved |
| enrichmentRedisKey | ✅ | ✅ | Generated if missing |
| seniorityScore | ✅ | ✅ | If not skipIntelligence |
| buyingPowerScore | ✅ | ✅ | If not skipIntelligence |
| urgencyScore | ✅ | ✅ | If not skipIntelligence |
| rolePowerScore | ✅ | ✅ | If not skipIntelligence |
| buyerLikelihoodScore | ✅ | ✅ | If not skipIntelligence |
| readinessToBuyScore | ✅ | ✅ | If not skipIntelligence |
| careerMomentumScore | ✅ | ✅ | If not skipIntelligence |
| careerStabilityScore | ✅ | ✅ | If not skipIntelligence |
| profileSummary | ✅ | ✅ | If not skipIntelligence |
| tenureYears | ✅ | ✅ | If not skipIntelligence |
| currentTenureYears | ✅ | ✅ | If not skipIntelligence |
| totalExperienceYears | ✅ | ✅ | If not skipIntelligence |
| avgTenureYears | ✅ | ✅ | If not skipIntelligence |
| careerTimeline | ✅ | ✅ | If not skipIntelligence |
| title | ✅ | ✅ | From normalizeContactApollo |
| seniority | ✅ | ✅ | From normalizeContactApollo |
| department | ✅ | ✅ | From normalizeContactApollo |
| jobRole | ✅ | ✅ | From normalizeContactApollo |
| linkedinUrl | ✅ | ✅ | From normalizeContactApollo |
| city | ✅ | ✅ | From normalizeContactApollo |
| state | ✅ | ✅ | From normalizeContactApollo |
| country | ✅ | ✅ | From normalizeContactApollo |
| timezone | ❌ | ✅ | Field in save route but not extracted |
| currentRoleStartDate | ✅ | ✅ | From normalizeContactApollo |
| totalYearsExperience | ✅ | ✅ | From normalizeContactApollo |
| numberOfJobChanges | ✅ | ✅ | From normalizeContactApollo |
| averageTenureMonths | ✅ | ✅ | From normalizeContactApollo |
| careerProgression | ✅ | ✅ | From normalizeContactApollo |
| recentJobChange | ✅ | ✅ | From normalizeContactApollo |
| recentPromotion | ❌ | ✅ | Field in save route but not calculated |
| companyName | ✅ | ✅ | From normalizeContactApollo |
| companyDomain | ✅ | ✅ | From normalizeContactApollo |
| companySize | ✅ | ✅ | From normalizeContactApollo |
| companyIndustry | ✅ | ✅ | From normalizeContactApollo |

## Issues Found

1. **timezone** - Save route includes it but normalizeContactApollo never sets it (always undefined)
2. **recentPromotion** - Save route includes it but normalizeContactApollo never calculates it
3. **photo_url** - Available in Apollo but not extracted or saved (would need schema change)

## Recommendations

1. **Fix timezone extraction** - Add basic timezone inference from location or remove from save route
2. **Fix recentPromotion calculation** - Add logic to detect promotions in employment history
3. **Consider adding avatarUrl** - Extract photo_url from Apollo and add to schema if needed
4. **Verify intelligence scores are actually computed** - Check if Apollo payload has the data needed

