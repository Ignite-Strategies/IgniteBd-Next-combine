# Product Tiers Implementation - What We Built

**Date**: January 2025  
**Purpose**: Layered product tiers with feature registry for navbar hydration

---

## 🎯 What We Built

### 1. **Product Tiers** (3 tiers)
- **`foundation`** - Core features only (CRM, Contacts, Content, Personas)
- **`growth`** - Foundation + Attract layer (adds Events, Event Intel)
- **`scale`** - Foundation + Attract + Activate (adds Outreach, Campaigns, Automation)

### 2. **Product Layers** (3 layers)
- **`core`** - Always included (Dashboard, CRM, Contacts, Personas, Content, etc.)
- **`attract`** - Signal generation (Events, Event Intel, Persona Matching)
- **`activate`** - Execution/scale (Outreach, Campaigns, Automation) - FUTURE

### 3. **Feature Registry**
- Single source of truth for all features
- Each feature has: `key`, `label`, `route`, `layer`, `icon`, `group`
- Features are mapped to layers

### 4. **Navbar Hydration Flow**

```
User loads page
  ↓
useOwner() hook gets owner data
  ↓
owner.tier (from database) → defaults to 'foundation' if null
  ↓
resolveEnabledFeatures(tier) 
  ↓
Checks TIER_LAYERS[tier] → gets allowed layers
  ↓
Filters FEATURE_REGISTRY by allowed layers
  ↓
Sidebar renders only enabled features
```

---

## 📊 How Navbar Gets Features

### Step-by-Step:

1. **Sidebar Component** (`components/Sidebar.jsx`)
   ```javascript
   const { owner } = useOwner();  // Gets owner from hook
   const tier = owner?.tier || 'foundation';  // Defaults to foundation
   const enabledFeatures = resolveEnabledFeatures(tier);  // Gets features for tier
   ```

2. **Owner Hydration** (`app/api/owner/hydrate/route.js`)
   - Returns `owner.tier` from database
   - Stored in `localStorage` by `useOwner()` hook
   - Sidebar reads from `owner.tier`

3. **Feature Resolution** (`lib/product/resolveFeatures.ts`)
   ```javascript
   // foundation tier → ['core'] layer
   // growth tier → ['core', 'attract'] layers  
   // scale tier → ['core', 'attract', 'activate'] layers
   
   // Filters FEATURE_REGISTRY to only features in allowed layers
   ```

4. **Sidebar Renders**
   - Groups features by `group` property
   - Renders navigation items
   - Only shows features user's tier allows

---

## 🗄️ Database Changes

### Schema Update:
```prisma
model owners {
  // ... existing fields ...
  tier String? @default("foundation") // Product tier: foundation, growth, scale
  // ... rest of fields ...
}
```

### Migration Needed:
- Add `tier` column to `owners` table
- Default value: `'foundation'`
- Existing owners get `'foundation'` tier

---

## 🔄 Current State

**What Works:**
- ✅ Tier system defined (foundation, growth, scale)
- ✅ Layer system defined (core, attract, activate)
- ✅ Feature registry created
- ✅ Sidebar uses feature registry
- ✅ Feature resolution logic works

**What's Missing:**
- ⚠️ Database migration not run yet
- ⚠️ Existing owners don't have `tier` set (defaults to 'foundation' in code)
- ⚠️ No way to upgrade tiers yet (manual DB update for now)

---

## 🧪 Testing

**To test different tiers:**
1. Update owner in database: `UPDATE owners SET tier = 'growth' WHERE id = '...'`
2. Refresh page
3. Sidebar should show more features (Events, etc.)

**Default behavior:**
- All existing owners → `foundation` tier → Core features only
- New owners → `foundation` tier (from schema default)

---

## 📝 Files Created/Modified

**New Files:**
- `lib/product/layers.ts` - Layer definitions
- `lib/product/tiers.ts` - Tier definitions  
- `lib/product/features.ts` - Feature registry
- `lib/product/resolveFeatures.ts` - Feature resolution logic
- `scripts/set-default-tiers.js` - Migration script

**Modified Files:**
- `components/Sidebar.jsx` - Now uses feature registry
- `prisma/schema.prisma` - Added `tier` field
- `app/api/owner/hydrate/route.js` - Returns `tier` field

---

## 🎯 Next Steps

1. **Run migration** to add `tier` column
2. **Run script** to set default tiers for existing owners
3. **Test** with different tiers
4. **Add tier upgrade flow** (future - manual DB for now)

