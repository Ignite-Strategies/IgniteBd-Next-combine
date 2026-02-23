# Assembly Helper Personas Flow

## Overview

Snippets can match multiple personas via `assemblyHelperPersonas` array. This allows flexible matching where a snippet like "how is your competitor" can work for both "FormerColleague" and "UsesCompetitor" personas.

## Flow

1. **Upload Contact** → Contact is created
2. **Assign Persona** → Contact gets `outreachPersonaSlug` (e.g., `FormerColleagueNowReachingoutAgainAfterLongTime`)
3. **Run Assembly** → Assembly service uses contact's persona to select snippets
4. **Snippet Matching** → Snippets match if their `assemblyHelperPersonas` array includes the contact's persona slug

## Example

**Contact:**
- `outreachPersonaSlug`: `FormerColleagueNowReachingoutAgainAfterLongTime`

**Snippet:**
- `snipName`: `competitor_checkin`
- `snipText`: "How is your current provider working for you?"
- `assemblyHelperPersonas`: `["FormerColleague", "UsesCompetitor", "PriorConversation"]`

**Match:** ✅ Snippet matches because `assemblyHelperPersonas` includes "FormerColleague" (which matches the contact's persona pattern)

## Schema Changes

**content_snips:**
- Removed: `bestForPersonaSlug` (single FK)
- Added: `assemblyHelperPersonas String[]` (array of persona slugs)

**Contact:**
- Added: `outreachPersonaSlug String?` (assigned persona FK)

## Assembly Logic

The assembly service checks if a snippet's `assemblyHelperPersonas` array includes the contact's persona slug (or matches patterns within it).

**Priority:**
1. Exact match in `assemblyHelperPersonas` array
2. General snippets (empty array)
3. First available snippet

## Benefits

✅ **Flexible Matching:** Snippets can work for multiple personas  
✅ **Smart Assembly:** Persona drives snippet selection  
✅ **Future Smart Assign:** Can auto-assign personas based on relationship context, connection date, etc.  
