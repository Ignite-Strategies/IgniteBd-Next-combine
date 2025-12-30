# Persona MVP1 vs MVP2

## MVP1 (Current) - Just the Essentials

**Minimal Persona Fields:**
1. **personName** - Who they are (e.g., "Compliance Manager", "Deputy Counsel")
2. **title** - Their role/title (e.g., "Deputy Counsel", "Compliance Manager at X Firm")
3. **company** - What company (e.g., "X Firm")
4. **coreGoal** - Their north star (one sentence)

**That's it.** Simple. "Compliance Manager at X Firm" - that's a persona.

**Service:** `PersonaMinimalService`
**Endpoint:** `/api/personas/generate-minimal`
**No product complexity, no deep dives, no phases.**

## MVP2 (Future) - Product Fit & Details

**Additional Fields (scaffolded but not generated yet):**
- `role` - Additional role context
- `seniority` - Seniority level
- `needForOurProduct` - Need for OUR product (inferred)
- `potentialPitch` - How we'd pitch (inferred)
- `painPoints` - Array of pain points
- `industry` - Industry type
- `companySize` - Company size

**MVP2 Features:**
- Product fit analysis
- Deep dive on product alignment
- Pain point analysis
- Pitch recommendations

**Service:** `PersonaGeneratorService` (full version)
**Endpoint:** `/api/personas/generate` (enhanced)

## Migration Path

MVP1 → MVP2:
- Keep MVP1 simple and working
- Scaffold MVP2 fields in the schema (nullable)
- When ready, enhance `PersonaGeneratorService` with product analysis
- Keep `PersonaMinimalService` as the simple fallback

## Key Principle

**MVP1 = "Compliance Manager at X Firm" - that's a persona. Done.**

