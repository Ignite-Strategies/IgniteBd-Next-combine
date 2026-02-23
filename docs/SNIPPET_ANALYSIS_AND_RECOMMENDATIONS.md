# Content Snippet Analysis & Recommendations

## Current State Analysis

### Problem: Generic "Intent" Snippets

Looking at your current snippets, the **intent** category has become a catch-all for generic openings that don't add much strategic value:

**Current Intent Snippets:**
- `intent_follow_up` - "I wanted to follow up" (too generic)
- `intent_reach_out` - "I wanted to reach out" (too generic)
- `intent_hope_finds_well` - "I hope this finds you well" (generic greeting)
- `intent_introduce_as_resource` - "I wanted to introduce {FirmName} as a resource" (better, but still generic)
- `intent_follow_up_year_transition` - "I wanted to follow up as we move further into 2026" (seasonal, but still generic)
- `intent_wish_belated_new_year` - "I wanted to wish you a belated Happy New Year" (seasonal, but generic)

### Issues Identified

1. **Intent snippets are too generic** - They don't communicate WHY you're reaching out, just that you are
2. **Intent vs. Context confusion** - The `intentType` field (reactivation, prior_contact, intro) describes the relationship context, not the actual intent
3. **Missing strategic value** - These snippets don't differentiate your outreach or add value
4. **AI can't use them effectively** - Generic openings don't help AI understand what you're trying to accomplish

## Recommendations

### 1. Refactor Intent Snippets → Strategic Openings

Instead of generic "I wanted to reach out", create snippets that communicate **strategic intent**:

**Better Intent Snippets:**
```
intent_reconnect_after_time
"I've been thinking about our conversation about [topic] and wanted to reconnect."

intent_share_relevant_insight  
"I came across something that made me think of you and wanted to share."

intent_check_in_on_initiative
"I wanted to check in on how [specific initiative/project] is going for you."

intent_offer_specific_value
"I noticed [specific observation] and thought I might be able to help with [specific value]."

intent_reference_shared_experience
"Following up on our discussion about [specific topic], I wanted to share an update."
```

### 2. Use Intent Types More Strategically

The `intentType` field should describe **relationship context**, not generic intent:

- **reactivation** - Reconnecting after long gap
- **prior_contact** - Following up on previous conversation
- **intro** - First-time introduction
- **competitor** - They're working with someone else
- **seasonal** - Time-based (holidays, year transitions)
- **relationship_only** - Just maintaining relationship, no ask

But the **snippet text itself** should be strategic and specific.

### 3. Restructure Snippet Categories

**Current Structure (Problematic):**
- `intent` - Generic openings (too many, too generic)
- `cta` - Call to actions (good)
- `service` - What you do (good)
- `competitor` - Competitive positioning (good)
- `value` - Value propositions (good)
- `relationship` - Relationship maintenance (good)
- `subject` - Subject lines (good)

**Recommended Structure:**
- **Remove generic `intent` snippets** - Replace with strategic openings
- **Keep `cta`, `service`, `competitor`, `value`, `relationship`, `subject`** - These are working well
- **Add `opening` category** - For strategic, context-aware openings (replaces generic intents)
- **Add `context` category** - For setting up why you're reaching out (replaces some generic intents)

### 4. Better Snippet Examples

**Instead of:**
```
intent_reach_out: "I wanted to reach out"
```

**Use:**
```
opening_reconnect_prior_conversation: "Following up on our conversation about {{topic}}, I wanted to share an update that might be relevant."
opening_share_insight: "I came across {{specific_thing}} and it made me think of you and {{their_situation}}."
opening_check_in_initiative: "I wanted to check in on how {{specific_initiative}} is going for you."
```

**Instead of:**
```
intent_follow_up: "I wanted to follow up"
```

**Use:**
```
context_follow_up_on_discussion: "Following up on our discussion about {{topic}}, I wanted to see if {{specific_question_or_offer}}."
context_time_passed_update: "It's been {{timeframe}} since we last connected, and I wanted to share {{specific_update}}."
```

### 5. AI Template Builder Impact

With better snippets, the AI can:
- **Understand strategic intent** - Not just "reaching out" but "reconnecting about specific topic"
- **Select relevant context** - Match snippets to actual relationship and situation
- **Build coherent flow** - Strategic opening → Context → Value → Ask → Close

## Action Plan

### Phase 1: Audit & Cleanup
1. Review all `intent` type snippets
2. Identify which are truly generic (delete or archive)
3. Identify which can be made more strategic (refactor)

### Phase 2: Create Strategic Replacements
1. Create new `opening` snippets with strategic intent
2. Create new `context` snippets for setting up the "why"
3. Keep only the best `intent` snippets (seasonal, relationship-specific)

### Phase 3: Update AI Prompts
1. Update AI template builder to prioritize strategic openings
2. Train AI to understand the difference between generic and strategic snippets
3. Improve snippet selection logic

### Phase 4: Test & Iterate
1. Test AI template builder with new snippet structure
2. Gather feedback on generated templates
3. Refine snippets based on what works

## Example: Before vs After

**Before (Generic):**
```
Subject: {Company}
Body:
{{snippet:intent_reach_out}}

{{snippet:service_ndas_workflow_support}}

{{snippet:cta_brief_call_worthwhile}}
```

**After (Strategic):**
```
Subject: NDA Processing Check-In
Body:
{{snippet:opening_reconnect_prior_conversation}}

{{snippet:context_follow_up_on_discussion}}

{{snippet:service_ndas_workflow_support}}

{{snippet:value_growth_bandwidth}}

{{snippet:cta_10_15_minutes_calendar}}
```

The "after" version:
- Has strategic opening that references prior conversation
- Sets up context for why reaching out
- Provides value proposition
- Has specific CTA

## Key Insight

**Intent snippets should communicate STRATEGIC PURPOSE, not generic action.**

Instead of "I wanted to reach out" (action), use "Following up on our conversation about X" (strategic purpose with context).

This makes snippets:
1. More useful for AI selection
2. More valuable in templates
3. More differentiated in outreach
4. Easier to combine into coherent templates
