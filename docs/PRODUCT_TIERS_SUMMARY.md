# Product Tiers - What We Built (Real Talk)

## 🎯 The 3 Tiers

1. **`foundation`** - Core features only
   - Dashboard, CRM, Contacts, People, Personas, Products, Content, BD Intelligence, Settings
   - This is the base tier everyone gets

2. **`growth`** - Foundation + Attract layer
   - Everything in foundation PLUS
   - Events, Ads & SEO
   - For users who want signal generation

3. **`scale`** - Everything
   - Foundation + Growth + Activate layer
   - Adds: Outreach, Client Operations
   - Full feature set

---

## 🔄 How Navbar Hydration Works

### The Flow:

```
1. User loads page
   ↓
2. Sidebar component mounts
   ↓
3. useOwner() hook runs
   - Gets owner from localStorage (cached)
   - OR calls /api/owner/hydrate if not cached
   ↓
4. owner.tier comes from database
   - Defaults to 'foundation' if null
   ↓
5. resolveEnabledFeatures(owner.tier) runs
   - Checks: foundation → ['core'] layers
   - Checks: growth → ['core', 'attract'] layers
   - Checks: scale → ['core', 'attract', 'activate'] layers
   ↓
6. Filters FEATURE_REGISTRY
   - Only features in allowed layers
   ↓
7. Sidebar renders those features
```

### Key Point:
- **Navbar is NOT hydrated from API**
- **Navbar reads `owner.tier` from `useOwner()` hook**
- **`useOwner()` gets tier from `/api/owner/hydrate` response**
- **Tier is stored in `localStorage` by `useOwner()` hook**

---

## 📊 What We Actually Did

### Created Files:
1. **`lib/product/layers.ts`** - Defines 3 layers (core, attract, activate)
2. **`lib/product/tiers.ts`** - Defines 3 tiers and which layers they include
3. **`lib/product/features.ts`** - Feature registry (all features with their layer)
4. **`lib/product/resolveFeatures.ts`** - Logic to get enabled features for a tier

### Modified Files:
1. **`components/Sidebar.jsx`** - Now uses feature registry instead of hardcoded nav
2. **`prisma/schema.prisma`** - Added `tier` field to owners table
3. **`app/api/owner/hydrate/route.js`** - Returns `tier` field in response

### Database:
- Added `tier` column to `owners` table
- Default value: `'foundation'`
- Migration file created (needs to be run)

---

## 🧪 How to Test

### Set a user's tier:
```sql
UPDATE owners SET tier = 'growth' WHERE email = 'your@email.com';
```

### Then refresh page - sidebar should show:
- Foundation tier: Core features only
- Growth tier: Core + Events, Ads
- Scale tier: Everything

---

## ⚠️ Current State

**What Works:**
- ✅ Tier system defined
- ✅ Feature registry created
- ✅ Sidebar uses registry
- ✅ Logic works (filters by tier)

**What Needs to Happen:**
- ⚠️ Run migration to add `tier` column
- ⚠️ Existing owners will default to `'foundation'` (handled in code)
- ⚠️ No UI to upgrade tiers yet (manual DB update for now)

---

## 🎯 The Architecture

```
User (owner.tier = 'foundation')
  ↓
resolveEnabledFeatures('foundation')
  ↓
TIER_LAYERS['foundation'] = ['core']
  ↓
FEATURE_REGISTRY.filter(f => f.layer === 'core')
  ↓
Sidebar renders only core features
```

**It's that simple.** No complex logic, no state collisions, just:
- Tier → Layers → Features → Sidebar

