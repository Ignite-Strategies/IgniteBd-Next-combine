# Product Fits Relation Audit

## Problem
The codebase has inconsistent usage of Prisma relation names, causing repeated errors:
- `product_fits` model relates to `products` (plural), not `product` (singular)
- Many files use `prisma.product.*` when it should be `prisma.products.*`
- Frontend code accesses `.product` when it should be `.products`

## Schema (Source of Truth)

```prisma
model product_fits {
  id                 String   @id
  personaId          String   @unique
  productId          String
  valuePropToThem    String
  alignmentReasoning String
  personas           personas @relation(fields: [personaId], references: [id], onDelete: Cascade)
  products           products @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model products {
  id          String         @id
  // ... fields
  product_fits product_fits[]
}
```

## Correct Usage

### Prisma Client
- ✅ `prisma.products.findMany()` - Model name is `products` (plural)
- ✅ `prisma.product_fits.findUnique()` - Model name is `product_fits` (snake_case)

### Relations
- ✅ `personas.product_fits` - Relation on personas model (singular, one-to-one)
- ✅ `product_fits.products` - Relation on product_fits model (plural, many-to-one to products)

### Frontend/API Access
- ✅ `persona.product_fits.products.name` - Accessing the related product
- ❌ `persona.product_fits.product.name` - WRONG (singular)

## Files Fixed

### API Routes
1. `/app/api/personas/route.js` - Fixed `product_fits.products` includes
2. `/app/api/personas/[personaId]/route.js` - Fixed `product_fits.products` include
3. `/app/api/personas/[personaId]/bd-intel/route.ts` - Fixed `product_fits.products` include and access
4. `/app/api/personas/[personaId]/product-fit/route.ts` - Fixed `prisma.product` → `prisma.products`

### Frontend
5. `/app/(authenticated)/personas/[personaId]/page.jsx` - Fixed `product_fits.product` → `product_fits.products`

### Other Files Needing Fix
6. `/lib/intelligence/BDOSScoringService.ts` - `prisma.product` → `prisma.products`
7. `/app/api/bdos/score/route.ts` - `prisma.product` → `prisma.products`
8. `/app/api/business-intelligence/fit-score/route.js` - `prisma.product` → `prisma.products`
9. `/app/api/company/hydrate/route.js` - `prisma.product` → `prisma.products`
10. `/lib/services/BusinessIntelligenceScoringService.js` - `prisma.product` → `prisma.products`
11. `/app/api/products/[productId]/route.js` - `prisma.product` → `prisma.products`
12. `/app/api/products/route.js` - `prisma.product` → `prisma.products`
13. `/app/api/migration/localstorage/route.js` - `prisma.product` → `prisma.products`

## Prevention

To prevent this issue from recurring:
1. Always check the Prisma schema for exact model and relation names
2. Use TypeScript types from Prisma client for autocomplete
3. The model name in schema = Prisma client accessor (e.g., `model products` → `prisma.products`)
4. Relation names match the model they point to (e.g., `products products` → `.products`)

