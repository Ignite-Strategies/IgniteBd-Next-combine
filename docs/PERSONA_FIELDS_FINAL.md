# Persona Fields - Final Simple List

**Remember: This is a THINKING TOOL, not a complex system. Just help clients think through who they're targeting.**

## Final Field Structure (~10-11 fields)

```typescript
interface PersonaJSON {
  // WHO IS THIS PERSON (more role info)
  personName: string           // Required - Name/archetype (e.g., "Enterprise CMO")
  title: string                // Required - Role/Title (e.g., "Chief Marketing Officer")
  role: string | null          // Additional role context (more than just title)
  seniority: string | null     // Optional - Seniority (e.g., "C-Level", "Director")
  
  // WHAT DO THEY WANT (refactored - more like original)
  coreGoal: string             // Required - Their north star (regardless of our product) - what they want in general
  painPoints: string[]         // Array - What problems do they have? (from original - good field)
  needForOurProduct: string    // Required - Need for OUR PRODUCT assessment (inferred - this is key!)
  potentialPitch: string       // Optional - How we would pitch (inferred from pain point + what they might want)
  
  // WHAT COMPANY ARE THEY AT (standard company fields)
  industry: string | null      // Optional - Industry type
  companySize: string | null   // Optional - Company size (e.g., "51-200", "200-1000")
  company: string | null       // Optional - Company type/archetype (e.g., "mid-market SaaS")
}
```

**Total: ~10 fields. Clear structure. Helps client think through targeting.**
```

## Schema Mapping

**Current Schema Fields** (`personas` table):
```prisma
personName: String
title: String
seniority: String?
whatTheyWant: String?        // Could map to needForOurProduct
painPoints: String[]         // ✅ Maps to our field
industry: String?            // ✅ Maps to our field
companySize: String?         // ✅ Maps to our field
company: String?             // ✅ Maps to our field
description: String?         // Could use for coreGoal or potentialPitch
```

**New Fields Needed in Schema**:
- `coreGoal: String` - Their north star (general goal)
- `needForOurProduct: String` - Need assessment for our product (key field)
- `potentialPitch: String` - How to pitch to them
- `role: String?` - Additional role context (beyond title)

**Options**:
1. Add new fields to schema
2. Or repurpose existing fields temporarily (e.g., `whatTheyWant` → `needForOurProduct`)

## Why These Fields?

**This is a THINKING TOOL, not a data model.**

The fields help clients think through:
1. **Who am I selling to?** → personName, title, role, seniority
2. **What do they care about?** → coreGoal (their north star), painPoints
3. **What do they need from us?** → needForOurProduct (inferred assessment), potentialPitch
4. **Where are they?** → industry, companySize, company

**Key Insight:**
- `coreGoal` = What they want in general (their north star, regardless of our product)
- `needForOurProduct` = What they need from OUR product specifically (inferred - this is the key!)
- `potentialPitch` = How we'd pitch to them (inferred from pain points + needs)

That's it. Clear structure. Helps with planning.

## OpenAI Prompt Context

The service will include:
- Product information (name, description, valueProp)
- CompanyHQ context
- Contact/enrichment data

So `whatTheyWant` becomes product-specific automatically, while `coreGoals` stays general.

## Frontend Display

**Simple form fields (thinking tool UI):**
1. Person Name (text input) - "Who is this?"
2. Title (text input) - "What's their title?"
3. Role (text input) - "Additional role context" - Optional
4. Seniority (select dropdown) - Optional
5. Core Goal (text area) - "Their north star (regardless of our product)"
6. Pain Points (multi-line text/array) - "What problems do they have?"
7. Need for Our Product (text area) - "What do they need from OUR product?" (inferred - key field)
8. Potential Pitch (text area) - "How we would pitch to them" (inferred - optional)
9. Industry (text input) - "What industry?"
10. Company Size (text input) - "How big is the company?"
11. Company Type (text input) - "What kind of company?"

**That's it. Clear structure. Helps them think through targeting.**

