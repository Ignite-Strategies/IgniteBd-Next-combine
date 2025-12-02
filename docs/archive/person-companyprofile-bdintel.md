# Person & Company Profile - BD Intelligence Models

**Last Updated**: January 2025  
**Status**: 📋 Planning  
**Purpose**: Comprehensive data models for storing enriched contact and company intelligence data

---

## Overview

This document defines the complete data models for storing enriched contact and company intelligence data, including raw enrichment payloads, normalized data, computed intelligence scores, career signals, and company health metrics.

---

## 1. ContactEnrichmentProfile Model

### Purpose
Stores comprehensive enrichment data and intelligence scores for a contact, separate from the base Contact model. This allows for:
- Full enrichment history tracking
- Multiple enrichment sources
- Rich intelligence scoring
- Career timeline and signals
- Buyer readiness indicators

### Prisma Schema

```prisma
model ContactEnrichmentProfile {
  id                  String   @id @default(cuid())
  contactId           String   @unique // One-to-one with Contact
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // ============================================
  // ENRICHMENT SOURCE & METADATA
  // ============================================
  enrichmentSource    String   // "Apollo", "Lusha", "LinkedIn", etc.
  enrichmentFetchedAt DateTime // When enrichment was fetched
  enrichmentProvider  String?  // Specific provider/API used
  enrichmentVersion   String?  // Version of enrichment data structure

  // ============================================
  // RAW ENRICHMENT PAYLOAD
  // ============================================
  rawEnrichmentPayload Json? // Full raw JSON from enrichment provider (Apollo, Lusha, etc.)
  
  // ============================================
  // NORMALIZED CONTACT DATA
  // ============================================
  // Basic Info
  fullName            String?
  firstName           String?
  lastName            String?
  goesBy              String?
  email               String?
  phone               String?
  linkedinUrl         String?
  
  // Professional
  title               String?
  seniority           String?  // "executive", "vp", "director", "manager", "ic", etc.
  department          String?
  role                String?  // Specific role/function
  
  // Location
  city                String?
  state               String?
  country             String?
  timezone            String?
  
  // Company Context
  companyName         String?
  companyDomain       String?
  companyWebsite      String?
  companyIndustry     String?
  companySize         String?  // "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"
  
  // ============================================
  // INTELLIGENCE SCORES (0-100)
  // ============================================
  // Core Intelligence
  seniorityScore      Int?     // 0-100: Based on title/seniority level
  buyingPowerScore    Int?     // 0-100: Authority + company budget capacity
  urgencyScore        Int?     // 0-100: How urgent their need is
  rolePowerScore      Int?     // 0-100: Decision-making power in their role
  
  // Buyer Intelligence
  buyerLikelihoodScore Int?    // 0-100: Likelihood they're a buyer
  readinessToBuyScore  Int?    // 0-100: How ready they are to purchase
  
  // Career Intelligence
  careerMomentumScore  Int?    // 0-100: Career trajectory (promotions, job changes)
  careerStabilityScore Int?    // 0-100: Job stability (tenure, consistency)
  
  // ============================================
  // CAREER SIGNALS & TIMELINE
  // ============================================
  currentRoleStartDate DateTime? // When they started current role
  totalYearsExperience Float?    // Total years of professional experience
  numberOfJobChanges   Int?       // Number of job changes in career
  averageTenureMonths  Float?     // Average months per role
  
  // Career Timeline (stored as JSON array)
  careerTimeline       Json?      // Array of { company, title, startDate, endDate, duration }
  
  // Career Signals
  recentJobChange      Boolean?   // Changed jobs in last 6 months
  recentPromotion      Boolean?   // Promoted in last 12 months
  careerProgression    String?    // "accelerating", "stable", "declining"
  
  // ============================================
  // COMPANY INTELLIGENCE (from their company)
  // ============================================
  companyHealthScore   Int?       // 0-100: Company health from their org
  companyHeadcount     Int?       // Number of employees
  companyRevenue       Float?     // Annual revenue
  companyGrowthRate    Float?     // Growth rate percentage
  companyFundingStage  String?    // "seed", "series-a", "series-b", etc.
  companyLastFundingDate DateTime? // Last funding round date
  companyLastFundingAmount Float?  // Last funding amount
  
  // ============================================
  // BUYER SIGNALS
  // ============================================
  budgetAuthority      Boolean?   // Has budget authority
  decisionMaker        Boolean?   // Is a decision maker
  influencer           Boolean?   // Influences buying decisions
  gatekeeper           Boolean?   // Blocks or enables access
  
  // Buying Triggers
  buyingTriggers       String[]   // Array of trigger signals
  painPoints           String[]   // Pain points from enrichment
  goals                String[]   // Goals/objectives from enrichment
  
  // ============================================
  // RELATIONSHIPS
  // ============================================
  contact              Contact    @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@index([contactId])
  @@index([enrichmentSource])
  @@index([enrichmentFetchedAt])
  @@index([seniorityScore])
  @@index([buyingPowerScore])
  @@index([readinessToBuyScore])
  @@map("contact_enrichment_profiles")
}
```

### Field Descriptions

#### Enrichment Metadata
- **enrichmentSource**: Primary source (Apollo, Lusha, LinkedIn, etc.)
- **enrichmentFetchedAt**: Timestamp of enrichment
- **enrichmentProvider**: Specific API/provider used
- **enrichmentVersion**: Version of data structure for future migrations

#### Raw Data
- **rawEnrichmentPayload**: Complete JSON from enrichment provider (for future parsing/re-parsing)

#### Normalized Data
- All standard contact fields normalized from enrichment
- Company context fields for their current organization

#### Intelligence Scores (0-100)
- **seniorityScore**: Title-based seniority (C-level: 90-100, VP: 70-89, Director: 50-69, Manager: 30-49, IC: 0-29)
- **buyingPowerScore**: Authority + company budget (title: 0-60, company size: 0-25, revenue: 0-15)
- **urgencyScore**: Urgency indicators (recent job change: +30, growth: +20, funding: +15)
- **rolePowerScore**: Decision-making power in their specific role
- **buyerLikelihoodScore**: Probability they're a buyer for your product
- **readinessToBuyScore**: How ready they are to purchase (combines urgency + need + budget)
- **careerMomentumScore**: Career trajectory (promotions, upward movement)
- **careerStabilityScore**: Job stability (tenure, consistency)

#### Career Signals
- **careerTimeline**: JSON array of employment history
- **recentJobChange**: Boolean flag for recent moves
- **recentPromotion**: Boolean flag for recent promotions
- **careerProgression**: Overall trajectory indicator

#### Company Intelligence
- Company health metrics from their organization
- Funding information
- Growth indicators

#### Buyer Signals
- Boolean flags for buyer characteristics
- Arrays for triggers, pain points, goals

---

## 2. CompanyEnrichmentProfile Model

### Purpose
Stores comprehensive enrichment data and intelligence scores for a company, separate from the base Company model. This allows for:
- Full company intelligence tracking
- Multiple enrichment sources
- Health and growth metrics
- Funding and financial signals
- Market position indicators

### Prisma Schema

```prisma
model CompanyEnrichmentProfile {
  id                  String   @id @default(cuid())
  companyId           String   @unique // One-to-one with Company
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // ============================================
  // ENRICHMENT SOURCE & METADATA
  // ============================================
  enrichmentSource    String   // "Apollo", "Clearbit", "ZoomInfo", etc.
  enrichmentFetchedAt DateTime // When enrichment was fetched
  enrichmentProvider  String?  // Specific provider/API used
  enrichmentVersion   String?  // Version of enrichment data structure

  // ============================================
  // RAW ENRICHMENT PAYLOAD
  // ============================================
  rawEnrichmentPayload Json? // Full raw JSON from enrichment provider

  // ============================================
  // NORMALIZED COMPANY DATA
  // ============================================
  // Basic Info
  companyName         String?
  legalName           String?
  domain              String?  @unique
  website             String?
  industry            String?
  subIndustries       String[]  // Array of sub-industries
  description         String?   // Company description
  
  // Location
  headquartersCity    String?
  headquartersState   String?
  headquartersCountry String?
  timezone            String?
  
  // ============================================
  // COMPANY INTELLIGENCE SCORES (0-100)
  // ============================================
  companyHealthScore  Int?     // 0-100: Overall company health
  growthScore         Int?     // 0-100: Growth trajectory
  stabilityScore      Int?     // 0-100: Financial stability
  marketPositionScore Int?     // 0-100: Market position/competitiveness
  readinessScore      Int?     // 0-100: Readiness to buy/partner
  
  // ============================================
  // SIZE & SCALE METRICS
  // ============================================
  headcount           Int?     // Number of employees
  estimatedHeadcount  Int?     // Estimated if exact not available
  headcountRange      String?  // "1-10", "11-50", "51-200", etc.
  
  // ============================================
  // FINANCIAL METRICS
  // ============================================
  annualRevenue       Float?   // Annual revenue in USD
  revenueRange        String?  // "$1M-$10M", "$10M-$50M", etc.
  revenueGrowthRate   Float?   // Year-over-year growth rate percentage
  estimatedRevenue    Float?   // Estimated if exact not available
  
  // ============================================
  // FUNDING INFORMATION
  // ============================================
  fundingStage        String?  // "seed", "series-a", "series-b", "series-c", "ipo", "acquired"
  totalFundingRaised  Float?   // Total funding raised in USD
  lastFundingDate     DateTime? // Date of last funding round
  lastFundingAmount   Float?   // Amount of last funding round
  lastFundingRound    String?  // "seed", "series-a", etc.
  numberOfFundingRounds Int?   // Total number of funding rounds
  
  // Funding Timeline (stored as JSON array)
  fundingTimeline     Json?    // Array of { date, amount, round, investors }
  
  // ============================================
  // GROWTH SIGNALS
  // ============================================
  growthRate          Float?    // Growth rate percentage
  isGrowing           Boolean? // Boolean flag for growth
  isDeclining         Boolean? // Boolean flag for decline
  growthTrend         String?  // "accelerating", "stable", "declining"
  
  // Hiring Signals
  isHiring            Boolean? // Currently hiring
  openPositions       Int?     // Number of open positions
  hiringVelocity      String?  // "high", "medium", "low"
  
  // ============================================
  // MARKET POSITION
  // ============================================
  marketPosition      String?  // "leader", "challenger", "follower", "niche"
  competitivePosition String?  // Market share indicators
  marketCategory      String?  // Primary market category
  
  // ============================================
  // TECHNOLOGY & INFRASTRUCTURE
  // ============================================
  techStack           String[]  // Array of technologies used
  primaryTechStack    String[]  // Primary technologies
  infrastructureMaturity String? // "enterprise", "mid-market", "startup"
  
  // ============================================
  // OPERATIONAL METRICS
  // ============================================
  yearsInBusiness     Int?     // Years since founding
  foundedYear         Int?      // Year company was founded
  maturityStage       String?   // "startup", "growth", "mature", "enterprise"
  
  // ============================================
  // RELATIONSHIPS
  // ============================================
  company             Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([enrichmentSource])
  @@index([enrichmentFetchedAt])
  @@index([companyHealthScore])
  @@index([growthScore])
  @@index([readinessScore])
  @@index([domain])
  @@map("company_enrichment_profiles")
}
```

### Field Descriptions

#### Enrichment Metadata
- **enrichmentSource**: Primary source (Apollo, Clearbit, ZoomInfo, etc.)
- **enrichmentFetchedAt**: Timestamp of enrichment
- **enrichmentProvider**: Specific API/provider used
- **enrichmentVersion**: Version of data structure

#### Raw Data
- **rawEnrichmentPayload**: Complete JSON from enrichment provider

#### Normalized Data
- All standard company fields normalized from enrichment
- Location and industry information

#### Intelligence Scores (0-100)
- **companyHealthScore**: Overall health (headcount: 0-30, revenue: 0-30, growth: 0-20, funding: 0-20)
- **growthScore**: Growth trajectory indicators
- **stabilityScore**: Financial stability metrics
- **marketPositionScore**: Market position/competitiveness
- **readinessScore**: Readiness to buy/partner

#### Size & Scale
- **headcount**: Exact or estimated employee count
- **headcountRange**: Range if exact not available

#### Financial Metrics
- **annualRevenue**: Exact or estimated revenue
- **revenueRange**: Range if exact not available
- **revenueGrowthRate**: Year-over-year growth

#### Funding Information
- **fundingStage**: Current funding stage
- **totalFundingRaised**: Cumulative funding
- **fundingTimeline**: JSON array of funding rounds

#### Growth Signals
- **growthRate**: Growth percentage
- **isGrowing/isDeclining**: Boolean flags
- **growthTrend**: Overall trend indicator
- **isHiring**: Hiring activity flag
- **hiringVelocity**: Hiring pace indicator

#### Market Position
- **marketPosition**: Market leadership indicators
- **competitivePosition**: Competitive standing
- **marketCategory**: Primary market category

#### Technology
- **techStack**: Array of technologies
- **infrastructureMaturity**: Infrastructure sophistication

#### Operational
- **yearsInBusiness**: Company age
- **maturityStage**: Lifecycle stage

---

## 3. Updated Contact Model (Add Relation)

### Changes Needed

```prisma
model Contact {
  // ... existing fields ...
  
  // Add this relation:
  enrichmentProfile   ContactEnrichmentProfile?
  
  // ... rest of model ...
}
```

---

## 4. Updated Company Model (Add Relation)

### Changes Needed

```prisma
model Company {
  // ... existing fields ...
  
  // Add this relation:
  enrichmentProfile   CompanyEnrichmentProfile?
  
  // ... rest of model ...
}
```

---

## 5. Intelligence Scoring Services Architecture

### Service Structure

```
src/lib/intelligence/
├── ContactIntelligenceService.ts      (existing - reads from Contact)
├── CompanyIntelligenceService.ts       (existing - reads from Company)
├── EnrichmentParserService.ts          (existing - extracts from Apollo)
│
├── ContactEnrichmentService.ts         (NEW - computes all contact scores)
│   ├── computeSeniorityScore()
│   ├── computeBuyingPowerScore()
│   ├── computeUrgencyScore()
│   ├── computeRolePowerScore()
│   ├── computeBuyerLikelihoodScore()
│   ├── computeReadinessToBuyScore()
│   ├── computeCareerMomentumScore()
│   ├── computeCareerStabilityScore()
│   └── extractCareerTimeline()
│
└── CompanyEnrichmentService.ts         (NEW - computes all company scores)
    ├── computeCompanyHealthScore()
    ├── computeGrowthScore()
    ├── computeStabilityScore()
    ├── computeMarketPositionScore()
    ├── computeReadinessScore()
    └── extractFundingTimeline()
```

---

## 6. Enrichment → Intelligence Pipeline

### Flow

```
1. User enriches contact/company
   ↓
2. Apollo/Lusha/etc. returns raw data
   ↓
3. Store rawEnrichmentPayload in ContactEnrichmentProfile/CompanyEnrichmentProfile
   ↓
4. Normalize data (extract standard fields)
   ↓
5. Compute intelligence scores (all 8 contact scores, all 5 company scores)
   ↓
6. Extract career timeline / funding timeline
   ↓
7. Compute buyer signals and triggers
   ↓
8. Save complete ContactEnrichmentProfile/CompanyEnrichmentProfile to database
   ↓
9. Update Contact/Company with basic fields (backward compatibility)
```

### API Endpoint Updates

**Current**: `/api/contacts/enrich` - Updates Contact directly

**New Flow**: 
- Create/update `ContactEnrichmentProfile` with full intelligence
- Optionally sync key fields back to `Contact` for backward compatibility

---

## 7. Intelligence Score Computation Logic

### Contact Scores

#### seniorityScore (0-100)
- C-level (CEO, CTO, CFO, etc.): 90-100
- VP/Director: 70-89
- Manager/Senior: 50-69
- Individual Contributor: 30-49
- Entry/Junior: 0-29

#### buyingPowerScore (0-100)
- Title authority: 0-60 points
- Company size: 0-25 points
- Revenue indicators: 0-15 points

#### urgencyScore (0-100)
- Recent job change (last 6 months): +30
- Company growth (>50%): +20
- Recent funding (last 12 months): +15
- Base: 50

#### rolePowerScore (0-100)
- Decision-making authority in role
- Budget control indicators
- Influence on purchasing decisions

#### buyerLikelihoodScore (0-100)
- Role match to buyer persona
- Company fit indicators
- Industry alignment

#### readinessToBuyScore (0-100)
- Combines: urgency + need + budget + authority
- Weighted calculation

#### careerMomentumScore (0-100)
- Recent promotions: +30
- Upward title progression: +20
- Increasing responsibility: +15
- Base: 50

#### careerStabilityScore (0-100)
- Long tenure (>3 years): +30
- Consistent employment: +20
- Low job change frequency: +15
- Base: 50

### Company Scores

#### companyHealthScore (0-100)
- Headcount: 0-30 points
- Revenue: 0-30 points
- Growth rate: 0-20 points
- Funding events: 0-20 points

#### growthScore (0-100)
- Growth rate percentage
- Hiring velocity
- Market expansion indicators

#### stabilityScore (0-100)
- Financial stability
- Longevity indicators
- Market position

#### marketPositionScore (0-100)
- Market share
- Competitive standing
- Industry leadership

#### readinessScore (0-100)
- Readiness to buy/partner
- Budget availability
- Strategic initiatives

---

## 8. Data Migration Strategy

### Phase 1: Create New Models
1. Add `ContactEnrichmentProfile` and `CompanyEnrichmentProfile` to schema
2. Run migration: `npx prisma migrate dev --name add_enrichment_profiles`

### Phase 2: Backfill Existing Data
1. For contacts with `enrichmentPayload`:
   - Parse existing `enrichmentPayload` JSON
   - Compute all intelligence scores
   - Create `ContactEnrichmentProfile` record
2. For companies with intelligence fields:
   - Create `CompanyEnrichmentProfile` record
   - Populate from existing `companyHealthScore`, `headcount`, etc.

### Phase 3: Update Enrichment Pipeline
1. Update `/api/contacts/enrich` to create/update `ContactEnrichmentProfile`
2. Update company enrichment to create/update `CompanyEnrichmentProfile`
3. Keep backward compatibility: sync key fields to Contact/Company

### Phase 4: Update Services
1. Update `ContactIntelligenceService` to read from `ContactEnrichmentProfile`
2. Update `CompanyIntelligenceService` to read from `CompanyEnrichmentProfile`
3. Create new scoring services for additional scores

---

## 9. UI Integration

### Contact Detail Page - "Contact Outlook" Panel

Display:
- **Seniority**: `seniorityScore` / 100
- **Buyer Power**: `buyingPowerScore` / 100
- **Career Momentum**: `careerMomentumScore` / 100
- **Urgency**: `urgencyScore` / 100
- **Company Health**: `companyHealthScore` / 100 (from their company)
- **Readiness**: `readinessToBuyScore` / 100
- **Career Timeline**: Visual timeline from `careerTimeline` JSON
- **Company Stats**: Headcount, revenue, growth from company profile

---

## 10. Indexes & Performance

### ContactEnrichmentProfile Indexes
- `contactId` (unique) - Fast lookup by contact
- `enrichmentSource` - Filter by source
- `enrichmentFetchedAt` - Sort by freshness
- `seniorityScore`, `buyingPowerScore`, `readinessToBuyScore` - Filter/sort by scores

### CompanyEnrichmentProfile Indexes
- `companyId` (unique) - Fast lookup by company
- `enrichmentSource` - Filter by source
- `enrichmentFetchedAt` - Sort by freshness
- `companyHealthScore`, `growthScore`, `readinessScore` - Filter/sort by scores
- `domain` (unique) - Lookup by domain

---

## 11. Future Enhancements

### Potential Additions
- **Multi-source enrichment**: Store enrichment from multiple sources
- **Enrichment history**: Track changes over time
- **Confidence scores**: Confidence in each intelligence score
- **Signal decay**: Scores degrade over time without refresh
- **Custom scoring**: User-defined scoring weights
- **AI-enhanced signals**: GPT analysis of career/company signals

---

## Summary

### Models Created
1. ✅ **ContactEnrichmentProfile** - Complete contact intelligence model
2. ✅ **CompanyEnrichmentProfile** - Complete company intelligence model

### Key Features
- Raw enrichment payload storage
- Normalized data fields
- 8 contact intelligence scores
- 5 company intelligence scores
- Career timeline tracking
- Funding timeline tracking
- Buyer signals and triggers
- Growth and stability indicators

### Next Steps
1. Add models to Prisma schema
2. Create migration
3. Build intelligence scoring services
4. Update enrichment pipeline
5. Build UI display components

