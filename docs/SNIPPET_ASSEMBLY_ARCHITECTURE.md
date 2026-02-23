# Snippet Assembly Architecture

## Core Principle

**Snippets are independent building blocks.** Relationship context drives HOW to assemble them, not which snippets exist.

## Architecture

### 1. Snippets (Independent)
- No relationship context FK
- Optional `bestForPersonaType` hint (PersonaType enum or string)
- Just building blocks: `{ snipName, snipText, snipType }`

### 2. Relationship Contexts (For Assembly)
- Defines WHO the persona is
- Used by assembly service to select/order snippets
- Not stored on snippets themselves

### 3. Assembly Service (Relationship-Aware)
- Takes: relationship context + available snippets
- Returns: ordered list of snippets for template
- Logic: "Given this relationship context, which snippets work best?"

## Two Approaches

### Option A: Simple Persona Type Hint
```prisma
model content_snips {
  snipName String
  snipText String
  snipType String
  bestForPersonaType PersonaType? // Optional hint: DECISION_MAKER, INFLUENCER, etc.
  // No relationshipContextId
}
```

**Pros:**
- Simple, lightweight
- Snippets can hint at persona fit
- Assembly service uses persona type + relationship context

**Cons:**
- Less granular than full relationship context

### Option B: Pure Independence (No Hints)
```prisma
model content_snips {
  snipName String
  snipText String
  snipType String
  // No hints, no relationship context
  // Completely independent
}
```

**Pros:**
- Maximum flexibility
- Assembly service has full control
- Snippets are truly reusable

**Cons:**
- Assembly service needs to be smarter
- No hints for which snippets work for which personas

## Recommended: Option A with PersonaType Hint

**Why:**
- Snippets stay independent (no relationship context FK)
- Simple hint helps assembly service
- Persona type is already in the system
- Assembly service combines persona type + relationship context for selection

## Assembly Service Flow

```
1. User provides: relationship context (PRIOR_COLLEAGUE, RECENT, KNOWS_COMPANY)
2. System loads: all active snippets for company
3. Assembly service:
   - Filters snippets by snipType (opening, cta, etc.)
   - Considers bestForPersonaType if provided
   - Uses relationship context to select best matches
   - Orders snippets logically (opening → context → value → ask → close)
4. Returns: ordered snippet list for template
```

## Implementation

1. Remove `relationshipContextId` from `content_snips`
2. Add optional `bestForPersonaType PersonaType?` field
3. Keep `relationship_contexts` table for assembly logic
4. Create assembly service that uses relationship context + persona type
