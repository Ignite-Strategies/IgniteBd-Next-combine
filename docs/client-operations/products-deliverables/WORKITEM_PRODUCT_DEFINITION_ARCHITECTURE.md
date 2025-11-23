# WorkItem Product Definition Architecture

## Overview

This document describes the **WorkItem Product Definition** flow - a replica of the BD Product Definition system, but designed specifically for WorkItems within the Execution → Work Packages context.

**Key Principle**: This is a **replica, NOT a migration**. BD product tables and flows remain completely untouched.

## Architecture

### Route Structure

```
/app/(authenticated)/ignite/work-item/product-definition/page.tsx
```

**Query Parameters:**
- `workPackageItemId` (required) - The WorkPackageItem ID to associate the product definition with

### Data Flow

1. **User clicks "Do this work item"** on a WorkPackageItem with label "Product Definition"
2. **Router** (`workitem-router.ts`) maps label → `/ignite/work-item/product-definition?workPackageItemId={id}`
3. **Page component** loads:
   - WorkPackageItem context
   - Existing WorkCollateral (if saved)
   - Personas for "Targeted To" dropdown
4. **User fills form** with product definition fields
5. **Server action** saves to `WorkCollateral` table with:
   - `type: "PRODUCT_DEFINITION"`
   - `workPackageItemId`: Links to the WorkPackageItem
   - `contentJson`: All product definition fields as JSON
   - `title`: Product name
   - `status`: "IN_PROGRESS"

### Storage Model

**WorkCollateral** table stores the product definition:

```prisma
model WorkCollateral {
  id                String           @id @default(cuid())
  workPackageItemId String?
  workPackageItem   WorkPackageItem? @relation(...)
  
  type        String // "PRODUCT_DEFINITION"
  title       String? // Product name
  contentJson Json?  // All product definition fields
  
  status WorkCollateralStatus @default(IN_PROGRESS)
  // ... timestamps
}
```

## Field Mapping

All fields from BD Product Definition are replicated:

### Basic Information
- `name` (required) - Product/Service Name
- `category` - Category or type
- `valueProp` - Value Proposition
- `description` - Full description

### Pricing
- `price` - Price amount
- `priceCurrency` - USD, EUR, GBP, CAD
- `pricingModel` - one-time, recurring, usage-based, freemium, custom

### Targeting & Market
- `targetedTo` - Persona ID (optional)
- `targetMarketSize` - enterprise, mid-market, small-business, startup, individual
- `salesCycleLength` - immediate, short, medium, long, very-long

### Details
- `deliveryTimeline` - Delivery timeline string
- `features` - Key features (textarea)
- `competitiveAdvantages` - Competitive advantages (textarea)

## File Structure

```
src/
├── lib/
│   ├── schemas/
│   │   └── workItemProductDefinitionSchema.ts    # Zod validation schema
│   ├── actions/
│   │   └── workItemProductDefinition.ts          # Server actions (save/load)
│   └── workitem-router.ts                        # Routing utility (updated)
├── components/
│   └── workitem/
│       └── WorkItemProductDefinitionForm.tsx     # Form component
└── app/
    └── (authenticated)/
        └── ignite/
            └── work-item/
                └── product-definition/
                    └── page.tsx                   # Main page component
```

## Server Actions

### `saveWorkItemProductDefinition(workPackageItemId, data)`

**Purpose**: Save product definition to WorkCollateral

**Process**:
1. Validate input with Zod schema
2. Verify WorkPackageItem exists
3. Check for existing WorkCollateral with type "PRODUCT_DEFINITION"
4. Create or update WorkCollateral
5. Update WorkPackageItem status to "IN_PROGRESS" if new
6. Return success/error

### `loadWorkItemProductDefinition(workPackageItemId)`

**Purpose**: Load saved product definition from WorkCollateral

**Process**:
1. Find WorkCollateral with type "PRODUCT_DEFINITION"
2. Extract data from `contentJson`
3. Return form-ready data structure

### `getWorkPackageItem(workPackageItemId)`

**Purpose**: Get WorkPackageItem context (for display)

**Returns**: WorkPackageItem with related WorkPackage and Contact

## Example WorkCollateral Record

```json
{
  "id": "clx1234567890",
  "workPackageItemId": "clx9876543210",
  "type": "PRODUCT_DEFINITION",
  "title": "Business Development Platform",
  "contentJson": {
    "name": "Business Development Platform",
    "category": "Business Development Service",
    "valueProp": "Systematic outreach, relationship building, and growth acceleration for professional services clients.",
    "description": "A comprehensive business development platform designed to help professional services clients...",
    "price": null,
    "priceCurrency": "USD",
    "pricingModel": "recurring",
    "targetedTo": "clx_persona_123",
    "targetMarketSize": "small-business",
    "salesCycleLength": "medium",
    "deliveryTimeline": "2-4 weeks setup, ongoing support",
    "features": "- Systematic outreach and relationship building\n- Contact management and pipeline tracking\n- ...",
    "competitiveAdvantages": "- Contact + Company First Architecture\n- BD Intelligence scoring powered by OpenAI\n- ..."
  },
  "status": "IN_PROGRESS",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Integration Points

### Routing

Updated `workitem-router.ts`:
- `getWorkItemRoute(label, workPackageItemId?)` now accepts optional item ID
- Adds `workPackageItemId` as query parameter to route

Updated `PhaseItems.jsx`:
- `handleDoWorkItem` now passes `item.id` to router

### No BD Interference

- **No Product table writes** - All data goes to WorkCollateral
- **No BD API calls** - Uses WorkItem server actions only
- **No BD component imports** - Standalone form component
- **Separate routing** - `/ignite/work-item/*` vs `/products/*`

## Next Steps

After this foundation is in place:

1. **GPT Generation** - Use product definition data to generate content
2. **Deliverable Output** - Link generated content to WorkSupport/Deliverables
3. **Review Workflow** - Status transitions (IN_PROGRESS → IN_REVIEW → APPROVED)
4. **Client Portal** - Display product definitions in client view

## Validation

- **Zod schema** validates all fields on save
- **Required fields**: `name` only
- **Optional fields**: All others
- **Type safety**: TypeScript types generated from Zod schema

