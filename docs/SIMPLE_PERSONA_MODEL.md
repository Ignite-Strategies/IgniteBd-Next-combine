# Simple Outreach Persona Model

## Overview

Personas are now **10x simpler** - just descriptive slugs that drive snippet assembly. No complex enums or relationship contexts.

## Model

```prisma
model outreach_personas {
  id          String   @id @default(cuid())
  slug        String   @unique // e.g., "FormerColleagueNowReachingoutAgainAfterLongTime"
  name        String   // Display name: "Former Colleague - Long Time"
  description String?  @db.Text // What this persona represents
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## How It Works

**Example Persona:**
- **Slug:** `FormerColleagueNowReachingoutAgainAfterLongTime`
- **Name:** `Former Colleague - Long Time`
- **Description:** `Someone you worked with before, reaching out again after a long time`

**Snippets:**
- Snippets have optional `bestForPersonaSlug` field
- Assembly service uses persona slug to select/order snippets
- Persona slug is the **single source of truth** for assembly

## Benefits

✅ **Simple:** Just slug, name, description  
✅ **Descriptive:** Slug tells the whole story  
✅ **Flexible:** Easy to add new personas  
✅ **Clear:** No complex enums or relationship contexts  

## Seeded Personas

1. `FormerColleagueNowReachingoutAgainAfterLongTime` - Former Colleague - Long Time
2. `NewContactAtTargetCompany` - New Contact - Target Company
3. `WarmIntroductionFromMutualConnection` - Warm Introduction
4. `PriorConversationNeverFollowedUp` - Prior Conversation - No Follow-up
5. `CompetitorSwitchingProspect` - Competitor Switching Prospect
6. `ColdOutreachToDecisionMaker` - Cold Outreach - Decision Maker
7. `ReactivationAfterStaleRelationship` - Reactivation - Stale Relationship
8. `SeasonalReconnection` - Seasonal Reconnection

## Usage

**Assembly Service:**
```javascript
import { assembleSnippetsForTemplate } from '@/lib/services/snippetAssemblyService';

const result = assembleSnippetsForTemplate({
  personaSlug: 'FormerColleagueNowReachingoutAgainAfterLongTime',
  availableSnippets: [...],
});
```

**API:**
- `GET /api/outreach-personas` - List all personas
- `POST /api/outreach-personas` - Create new persona

**Snippets:**
- `bestForPersonaSlug` field (optional) - links snippet to persona
- Assembly service uses persona slug to select best snippets

## Migration

- Removed `PersonaType` enum from snippets
- Added `bestForPersonaSlug` string field (FK to `outreach_personas`)
- Assembly service now uses persona slugs instead of relationship contexts
