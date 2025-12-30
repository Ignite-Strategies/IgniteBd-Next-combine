# Persona-Product Flow Integration

## Current State

**Navigation:**
- Products (separate nav item)
- Personas (separate nav item)

**Flow:**
- Products: Create/manage products independently
- Personas: Create personas, optionally select product during generation

## The Problem

Products are foundational to personas (personas answer "who would buy THIS product"), but they're treated as separate concerns in the UI.

## User Insight

> "Products shouldn't be its own thing, but just a step in the persona flow"

**Concept**: Products are a prerequisite/step in the persona creation flow, not a separate feature.

## Solution: Products First, Then Personas

### Navigation Order (✅ DONE)
- **Products** → Comes first (foundational)
- **Personas** → Comes second (builds on products)

### Flow Integration Ideas

**Option 1: Product → Persona Wizard (Future)**
```
1. Create Product → Save
2. "Create Persona for this Product" button
3. Persona wizard starts with product pre-selected
```

**Option 2: Persona Builder Always Requires Product (Current)**
```
1. Go to Personas
2. Click "Add Persona"
3. Product selection is first step
   - Select existing product
   - OR "Create Product" button (inline)
4. Then generate/edit persona
```

**Option 3: Products as Part of Persona Builder (Future Enhancement)**
```
1. Personas page
2. "Add Persona" → Opens builder
3. First step: "Which product?" 
   - Shows product list
   - "New Product" option → Creates product inline → Returns to persona builder
4. Continue with persona generation
```

## Current Implementation

**Navigation:** ✅ Products before Personas

**Persona Builder:**
- Shows product selection/description input
- Allows creating product (link to /products/builder)
- Can generate without product (soft fallback)

**From-Contact Flow:**
- Shows product selection first
- "Create Product" button if none exist
- Product description fallback

## Future Enhancements

1. **Inline Product Creation in Persona Builder**
   - Instead of linking to /products/builder, create product modal inline
   - Save product, then continue persona generation

2. **Product → Persona Quick Create**
   - From product detail page: "Create Persona" button
   - Pre-fills product context

3. **Product Required by Default**
   - Make product selection more prominent
   - Suggest creating product if none exist

## Key Principle

**Products are foundational, Personas build on them.**

The nav order reflects this: Products → Personas (logical flow).

