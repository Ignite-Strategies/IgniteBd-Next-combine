# Navigation UX Planning Document

## 🎯 Core Principle: Attract → Engage → Nurture

The navigation is organized around the core business development principle:

1. **ATTRACT** - Marketing, Branding, Content (get prospects in)
2. **ENGAGE** - Outreach, Campaigns, Meetings, Events (engage with prospects)
3. **NURTURE** - Contacts, Pipelines, Proposals, Deliverables (nurture through funnel)

Plus foundational sections:
- **Growth Ops** - Strategy, Intelligence, Foundation (enables all three)
- **Settings** - Configuration

---

## ✅ CORRECTED Navigation Structure (Attract → Engage → Nurture)

### **Growth Ops** (Strategy & Intelligence Foundation)
- BD Roadmap (Map) - **✅ CLEANED UP**: Hardcoded content removed, empty state in place
  - **CURRENT**: Empty state with vision for timeline/calendar
  - **SHOULD BE**: Dynamic timeline showing scheduled campaigns, events, meetings, 12-month plan
  - **DOCUMENTATION**: See `docs/BD_ROADMAP.md` for full vision and requirements
- Personas (UserCircle) - Buyer and partner archetypes
- Products (Package) - Products & Services
- BD Intelligence (Brain) - Targeting Intelligence

### **ATTRACT** (Marketing & Branding)
- Ads & SEO (BarChart) - Advertising and SEO
- Content (FileText) - Content management
- Branding Hub (Palette) - Branding assets

### **ENGAGE** (Outreach & Engagement - Hub-Spoke)
- **Engage Hub** (MessageSquare) - Hub at `/engage` (or `/outreach`)
  - Outreach Dashboard (shows campaigns, metrics)
  - Campaigns (Mail) - Email campaigns
  - Compose (Send) - Compose individual emails
  - Meetings (Calendar) - 1:1 or small group meetings
  - Events (Calendar) - Larger events/webinars
  
  **CURRENT**: Outreach Dashboard at `/outreach` shows campaigns but doesn't include Meetings/Events
  **PROPOSED**: Rename to "Engage Hub" and add action cards for Meetings and Events

### **NURTURE** (Contacts & Relationship Management)
- People Hub (Users) - Contact management dashboard
  - Contact Lists (List) - Manage contact lists
  - Companies (Building2) - Prospect/client companies
  - Deal Pipelines (GitBranch) - Configure deal pipeline stages
- Proposals (FileCheck) - Client proposals
- Deliverables (FileText) - Client deliverables

### **Settings**
- Settings (Settings) - Workspace settings

---

## Problems with Current Implementation

### 0. **Route Naming Confusion (CRITICAL!)**
- ❌ People Hub is at `/contacts` route
- ❌ `/contacts` sounds like "add contacts" action
- ✅ Should be `/people-hub` to indicate it's a dashboard/hub
- ✅ Contact action pages can stay at `/contacts/...` routes (upload, view, etc.)

### 1. **Wrong Structure**
- ❌ Personas, Products, BD Intelligence are separate sections
- ✅ Should all be under "Growth Ops"

### 2. **Growth Ops Has Wrong Items**
- ❌ Has: People Hub, Deal Pipelines, Outreach, Campaigns, Meetings, Events, Insights
- ✅ Should have: BD Roadmap, Personas, Products, BD Intelligence

### 3. **BD Roadmap is Hardcoded (CRITICAL!)**
- ❌ Has hardcoded `INITIAL_ITEMS` array
- ❌ Stored in localStorage, not database
- ❌ No connection to actual campaigns, events, meetings
- ❌ Just a static task checklist, not a timeline
- ✅ Should be dynamic timeline showing scheduled activities
- ✅ Should show when emails are going out
- ✅ Should show events by month (12-month plan)
- ✅ Should pull from actual campaign schedules, events, meetings

### 4. **Insights is Deprecated**
- ❌ Still in navigation
- ✅ Should be removed

### 5. **Icon Duplicates**
- Mail used for Campaigns AND Ads & SEO
- FileText used for Deliverables AND Content
- UserCircle used for Personas AND Branding Hub
- Calendar used for Meetings AND Events

---

## Hub-Spoke Navigation Pattern

### Concept
Each major section has a **Hub (Dashboard)** page that serves as the landing page, showing:
- Overview metrics/stats
- Action cards linking to "Spoke" pages
- Quick access to common tasks
- Context and guidance

The **Sidebar** links to the Hub, and the Hub links to individual Spoke pages.

### Current Hub Pages

1. **Growth Dashboard** (`/growth-dashboard`) - Main hub
   - Revenue progress tracking
   - Stack cards linking to all major areas
   - Quick access to BD Roadmap

2. **People Hub** (`/people-hub`) - People Ops hub ✅
   - Contact count stats
   - Action cards: Upload, View, Lists, Build List, Companies, Deal Pipelines
   - Refresh functionality
   - Quick guide
   - **NOTE**: Currently at `/contacts` but should be renamed to `/people-hub` for clarity

3. **Engage Hub** (`/engage` or `/outreach`) - Engagement hub ⚠️ NEEDS UPDATE
   - **CURRENT**: Outreach Dashboard at `/outreach` shows:
     - Campaign metrics (total, active, recipients, response rate)
     - Campaign cards
     - Targeting info from BD Intelligence
     - Links to create campaigns
   - **MISSING**: Meetings and Events are separate pages, not in hub
   - **PROPOSED**: Rename to "Engage Hub" and add action cards for:
     - Campaigns (already there)
     - Compose (could add)
     - Meetings (needs to be added)
     - Events (needs to be added)

### Proposed Hub-Spoke Structure (Attract → Engage → Nurture)

```
🏠 HOME (Hub)
└── Growth Dashboard (TrendingUp)
    └── Links to all other hubs

📈 GROWTH OPS (Foundation/Strategy - Direct links)
├── BD Roadmap (Map) - **✅ CLEANED UP**: Hardcoded content removed
│   - **CURRENT**: Empty state with vision for timeline/calendar
│   - **SHOULD BE**: Dynamic timeline showing scheduled campaigns, events, meetings
│   - **SHOULD BE**: 12-month plan with activities by month
│   - **SHOULD BE**: Timeline showing when emails are going out
│   - **DOCUMENTATION**: See `docs/BD_ROADMAP.md` for full vision
├── Personas (UserCircle) - Persona management
├── Products (Package) - Product management
└── BD Intelligence (Brain) - Targeting intelligence

🎨 ATTRACT (Marketing & Branding - Direct links)
├── Ads & SEO (BarChart) - /ads
├── Content (FileText) - /content
└── Branding Hub (Palette) - /branding-hub

📧 ENGAGE (Outreach & Engagement - Hub-Spoke)
└── Engage Hub (MessageSquare) - Hub at /engage (or keep /outreach)
    ├── Campaigns → /outreach/campaigns (via hub)
    ├── Compose → /outreach/compose (via hub)
    ├── Meetings → /meetings (via hub)
    └── Events → /events (via hub)
    
    **CURRENT ISSUE**: Outreach Dashboard at `/outreach` only shows campaigns
    - Doesn't include Meetings or Events
    - Should be renamed to "Engage Hub" and include all engagement activities
    - Hub should have action cards for: Campaigns, Compose, Meetings, Events

💼 NURTURE (Contacts & Relationships - Hub-Spoke)
└── People Hub (Users) - Hub at /people-hub
    ├── View Contacts → /contacts/view
    ├── Contact Lists → /contacts/list-manager
    ├── Companies → /contacts/companies
    ├── Deal Pipelines → /contacts/deal-pipelines

🔧 CLIENT OPERATIONS (Client Journey Management - Hub-Spoke) ✅ IMPLEMENTED
└── Initiate Client Journey (Rocket) - Hub at /client-operations ✅
    ├── Set Your Proposal → /client-operations/proposals/wizard
    ├── Invite Prospect to Portal → /contacts (via contact detail page)
    ├── Proposals → /client-operations/proposals
    └── Deliverables → /client-operations/deliverables
    
    **STATUS**: ✅ Fully implemented
    - Hub page at `/client-operations` with welcome message and action cards
    - "Set Your Proposal" card links to proposal wizard
    - "Invite Prospect to Portal" card links to contacts
    - Portal access generation available on contact detail pages
    - Shows recent proposals and contacts for quick access
    - Quick stats showing proposal counts
    
    **ROUTING**: Currently hub is at `/contacts` which is confusing
    - `/contacts` sounds like "add contacts" action
    - Should be `/people-hub` to reflect it's a dashboard/hub
    - Spoke pages can stay at `/contacts/...` routes (contact-specific actions)

⚙️ SETTINGS (Direct link)
└── Settings (Settings) - /settings
```

## Sidebar Navigation (Hub Links)

The sidebar should link to **Hub pages**, organized by **Attract → Engage → Nurture**:

```
🏠 HOME
└── Growth Dashboard

📈 GROWTH OPS (Foundation/Strategy)
├── BD Roadmap
├── Personas
├── Products
└── BD Intelligence

🎨 ATTRACT (Marketing & Branding)
├── Ads & SEO
├── Content
└── Branding Hub

📧 ENGAGE (Outreach & Engagement)
└── Engage Hub (links to /engage hub - or keep /outreach)
    ├── Campaigns (via hub action cards)
    ├── Compose (via hub action cards)
    ├── Meetings (via hub action cards)
    └── Events (via hub action cards)
    
    **NOTE**: Currently "Outreach Dashboard" at `/outreach` only shows campaigns
    - Should be renamed to "Engage Hub" 
    - Should include action cards for all engagement activities
    - Or create new `/engage` hub that consolidates everything

💼 NURTURE (Contacts & Relationships)
└── People Hub (links to /people-hub hub)
    ├── Contact Lists (via hub)
    ├── Companies (via hub)
    ├── Deal Pipelines (via hub)

🔧 CLIENT OPERATIONS (Client Journey Management) ✅ IMPLEMENTED
└── Initiate Client Journey (Rocket) - Hub at /client-operations ✅
    ├── Set Your Proposal (via hub action card)
    ├── Invite Prospect to Portal (via hub action card)
    ├── Proposals (direct link)
    └── Deliverables (direct link)

⚙️ SETTINGS
└── Settings
```

---

## Icon Fixes Needed

### Current Duplicates → New Icons
- ❌ Mail (Ads & SEO) → ✅ BarChart or Megaphone
- ❌ FileText (Content) → ✅ FileText (keep - different context) OR FileEdit
- ❌ UserCircle (Branding) → ✅ Palette or Image or Paintbrush
- ❌ Calendar (Events) → ✅ Calendar (can reuse with context) OR CalendarDays

### New Icons Needed
- `List` or `ListTodo` - Contact Lists
- `Send` - Compose Email
- `GitBranch` or `Workflow` - Deal Pipelines (instead of Building2)
- `Palette` or `Paintbrush` - Branding Hub (instead of UserCircle)
- `BarChart` or `TrendingUp` - Ads & SEO (instead of Mail)

---

## What is BD Roadmap? ✅ CLEANED UP

### Current Implementation (UPDATED)
**BD Roadmap** (`/pipelines/roadmap`) is currently:
- ✅ **Hardcoded content removed** - All hardcoded onboarding tasks have been deleted
- ✅ **Empty state** - Shows clear messaging about what the roadmap should be
- ✅ **Vision documented** - See `docs/BD_ROADMAP.md` for full vision and requirements
- ⏳ **Timeline view coming soon** - Placeholder for future timeline/calendar implementation

### What BD Roadmap SHOULD Be
**BD Roadmap** should be a **dynamic timeline/calendar** that shows:
- ✅ **Campaign Launches** - "We want to launch the first campaign in January"
- ✅ **Events Timeline** - Events scheduled by month (e.g., "by month 6 we want these events")
- ✅ **Email Schedules** - Timeline of when nurture emails go out
- ✅ **12-Month Plan** - Long-term BD plan showing activities by month
- ✅ **Activity Calendar** - Calendar view of all BD activities
- ✅ **Dynamic Data** - Pulls from actual campaigns, events, meetings (not hardcoded)
- ✅ **Database Backed** - Stores roadmap items in database

### Vision: BD Roadmap as Timeline
**BD Roadmap** should be like a **Gantt chart or calendar view** showing:
- Timeline of scheduled campaigns (email send dates)
- Events scheduled by month/quarter
- Meetings on calendar
- 12-month strategic plan
- Visual representation of BD activities over time

**Current**: Empty state with vision ✅ (hardcoded content removed)
**Next**: Build dynamic timeline showing scheduled activities ⏳
**Documentation**: See `docs/BD_ROADMAP.md` for full requirements

---

## Implementation Plan

### Step 0: Fix Route Naming (CRITICAL!)
- **Rename `/contacts` hub route to `/people-hub`**
  - Current: `/contacts` (confusing - sounds like "add contacts")
  - New: `/people-hub` (clear - it's a dashboard/hub)
  - Contact action pages can stay at `/contacts/...` (upload, view, etc.)
- Update all links pointing to the hub
- Update page title from "People Hub" to "People Hub" (keep name, change route)
- Keep spoke routes at `/contacts/...` (they're contact-specific actions)

### Step 1: Fix Growth Ops Section
- Move Personas FROM "Persona" section TO "Growth Ops"
- Move Products FROM "Product Services" section TO "Growth Ops"
- Move BD Intelligence FROM "Targeting Intelligence" section TO "Growth Ops"
- **BD Roadmap** - ✅ **CLEANED UP**: Hardcoded content removed, empty state in place
  - ✅ Hardcoded `INITIAL_ITEMS` removed
  - ✅ Empty state shows vision for timeline/calendar
  - ⏳ Next: Connect to database (create roadmap table/model)
  - ⏳ Next: Pull scheduled campaigns from `/api/campaigns`
  - 📄 See `docs/BD_ROADMAP.md` for full vision and requirements
  - Pull scheduled events from `/api/events`
  - Pull scheduled meetings from `/api/meetings`
  - Create timeline/calendar view
  - Show 12-month plan with activities by month
  - Show when emails are scheduled to go out
- Remove Insights (deprecated)

### Step 2: Create People Ops Section
- Move People Hub FROM `/contacts` TO `/people-hub` (route rename)
- Link in sidebar should say "People Hub" and go to `/people-hub`
- Hub page shows action cards linking to `/contacts/...` spoke pages
- Update BD Roadmap link from `/contacts` to `/people-hub`

### Step 3: Create Engage Hub (Consolidate Engagement Activities)
- **Transform Outreach Dashboard into "Engage Hub"**
  - Current: `/outreach` only shows campaigns
  - Proposed: Add action cards section (like People Hub)
  - Add action cards for: Campaigns, Compose, Meetings, Events
  - Keep campaign metrics and recent campaigns below action cards
  - OR create new `/engage` hub page that consolidates everything
- **Move Meetings and Events INTO Engage Hub**
  - Currently separate pages (`/meetings`, `/events`)
  - Add as action cards in Engage Hub
  - Hub becomes single entry point for all engagement
- **Move Outreach FROM "Growth Ops" TO "Engage"**
  - Already done (Outreach Dashboard exists)
  - Just needs to be renamed to "Engage Hub" and expanded

### Step 4: Reorder by Core Principle (Attract → Engage → Nurture → Client Operations)
- **Attract** section comes first (Ads & SEO, Content, Branding)
- **Engage** section (Engage Hub - single hub with all engagement activities)
  - Engage Hub at `/engage` (or keep `/outreach` but rename page)
  - Hub has action cards: Campaigns, Compose, Meetings, Events
- **Nurture** section (People Hub)
  - People Hub already in Nurture
- **Client Operations** section ✅ IMPLEMENTED
  - ✅ "Initiate Client Journey" hub at `/client-operations`
  - ✅ Hub has action cards: "Set Your Proposal" and "Invite Prospect to Portal"
  - ✅ Proposals and Deliverables remain in Client Operations (not moved to Nurture)
  - ✅ Portal access generation available on contact detail pages

### Step 5: Fix Icon Duplicates
- Change Ads & SEO icon from Mail to BarChart
- Change Branding Hub icon from UserCircle to Palette
- Change Deal Pipelines icon from Building2 to GitBranch

### Step 6: Remove Deprecated Items
- Remove Insights from navigation

### Step 7: Build BD Roadmap Timeline (Major Task)
- ✅ **Remove hardcoded items** (DONE)
  - Delete `INITIAL_ITEMS` array
  - Remove localStorage dependency
- **Create database model**
  - Create `RoadmapItem` model in Prisma schema
  - Store roadmap items in database
- **Connect to actual data**
  - Pull scheduled campaigns from database
  - Pull scheduled events from database
  - Pull scheduled meetings from database
  - Pull from actual campaign schedules (when emails go out)
- **Create timeline view**
  - Calendar/timeline UI showing scheduled activities
  - 12-month view showing activities by month
  - Gantt chart or calendar view
  - Show when emails are scheduled to send
  - Show events scheduled by month
- **API integration**
  - Create `/api/roadmap` endpoint
  - Aggregate data from campaigns, events, meetings
  - Return timeline data

---

## Final Structure (Hub-Spoke Pattern - Attract → Engage → Nurture)

### Sidebar Links to Hubs (Ordered by Core Principle)

```javascript
const navigationGroups = [
  {
    name: 'Growth Ops', // Foundation/Strategy
    items: [
      // ✅ BD Roadmap hardcoded content removed - empty state with vision
      // ⏳ Next: Build dynamic timeline (see docs/BD_ROADMAP.md)
      { name: 'BD Roadmap', path: '/pipelines/roadmap', icon: Map },
      { name: 'Personas', path: '/personas', icon: UserCircle },
      { name: 'Products', path: '/products', icon: Package },
      { name: 'BD Intelligence', path: '/bd-intelligence', icon: Brain },
    ],
  },
  {
    name: 'Attract', // Marketing & Branding
    items: [
      { name: 'Ads & SEO', path: '/ads', icon: BarChart },
      { name: 'Content', path: '/content', icon: FileText },
      { name: 'Branding Hub', path: '/branding-hub', icon: Palette },
    ],
  },
  {
    name: 'Engage', // Outreach & Engagement
    items: [
      // Single link to hub - hub has action cards to all engagement activities
      // NOTE: Currently "Outreach Dashboard" at /outreach only shows campaigns
      // Should be renamed to "Engage Hub" and include Meetings/Events action cards
      { name: 'Engage Hub', path: '/engage', icon: MessageSquare },
      // OR keep /outreach but rename page to "Engage Hub" and add Meetings/Events
    ],
  },
  {
    name: 'Nurture', // Contacts & Relationships
    items: [
      // Single link to hub - hub has action cards to spokes
      // NOTE: Currently at /contacts but should be /people-hub
      { name: 'People Hub', path: '/people-hub', icon: Users },
    ],
  },
  {
    name: 'Client Operations', // Client Journey Management ✅ IMPLEMENTED
    items: [
      // ✅ Hub page implemented at /client-operations
      // Hub has action cards: "Set Your Proposal" and "Invite Prospect to Portal"
      { name: 'Initiate Client Journey', path: '/client-operations', icon: Rocket },
      { name: 'Proposals', path: '/client-operations/proposals', icon: FileCheck },
      { name: 'Deliverables', path: '/client-operations/deliverables', icon: FileText },
    ],
  },
  {
    name: 'Settings',
    items: [
      { name: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];
```

### Hub Pages Link to Spokes

**People Hub** (`/people-hub`) should have action cards:
- Contact Upload → `/contacts/upload`
- View Contacts → `/contacts/view`
- Manage Contact Lists → `/contacts/list-manager`
- Build New List → `/contacts/list-builder`
- Add Business → `/contacts/companies`
- Deal Pipeline → `/contacts/deal-pipelines`

**CURRENT ISSUE**: Hub is incorrectly at `/contacts` route
- Users think "/contacts" = "add contacts" action
- Should be `/people-hub` to indicate it's a dashboard/hub
- Contact-specific actions (upload, view, etc.) can stay at `/contacts/...` routes

**Engage Hub** (`/engage` or `/outreach`) should have action cards:
- Campaigns → `/outreach/campaigns` (already exists in Outreach Dashboard)
- Compose → `/outreach/compose` (needs to be added to hub)
- Meetings → `/meetings` (needs to be added to hub)
- Events → `/events` (needs to be added to hub)

**CURRENT**: Outreach Dashboard at `/outreach` only shows campaigns
- Has campaign metrics and cards
- Links to create/view campaigns
- **MISSING**: No action cards for Meetings or Events
- **MISSING**: No link to Compose page

**PROPOSED**: Transform Outreach Dashboard into "Engage Hub"
- Add action cards section at top (like People Hub)
- Include: Campaigns, Compose, Meetings, Events
- Keep campaign metrics and recent campaigns below
- Or create new `/engage` hub page that consolidates everything

### Benefits of Hub-Spoke Pattern

1. **Clear Entry Points** - Users know where to start (the hub)
2. **Context** - Hub shows overview/metrics before diving into details
3. **Discoverability** - Action cards make features visible
4. **Less Clutter** - Sidebar stays clean with hub links
5. **Guided Navigation** - Hub can provide guidance and quick actions
6. **Progressive Disclosure** - Details available when needed

---

## Icon Imports Needed

```javascript
import {
  TrendingUp,  // Growth Dashboard
  Map,         // BD Roadmap
  UserCircle,  // Personas
  Package,     // Products
  Brain,       // BD Intelligence
  Users,       // Contacts
  List,        // Contact Lists
  Building2,   // Companies
  GitBranch,   // Deal Pipelines
  MessageSquare, // Outreach Dashboard
  Mail,        // Campaigns
  Send,        // Compose
  Calendar,    // Meetings/Events
  FileCheck,   // Proposals
  FileText,    // Deliverables/Content
  BarChart,    // Ads & SEO
  Palette,     // Branding Hub
  Rocket,      // Initiate Client Journey ✅
  Settings,    // Settings
} from 'lucide-react';
```

---

## Notes

### Hub-Spoke Pattern Summary (Attract → Engage → Nurture)

- **Growth Ops** = Foundation/Strategy (4 items) - Direct links, each is standalone
- **Attract** = Marketing & Branding (3 items) - Direct links
- **Engage** = Outreach & Engagement (hub with all activities)
  - **CURRENT**: Outreach Dashboard at `/outreach` (1 sidebar link)
    - Only shows campaigns
    - Missing: Meetings, Events, Compose links in hub
  - **PROPOSED**: Engage Hub (1 sidebar link)
    - Hub should have action cards for: Campaigns, Compose, Meetings, Events
    - Keep campaign metrics and recent campaigns
    - Single entry point for all engagement activities
- **Nurture** = Contacts & Relationships (hub + 2 direct links)
  - People Hub at `/people-hub` (1 sidebar link) - Hub links to 6+ spoke pages
    - **FIX NEEDED**: Currently at `/contacts` - confusing! Should be `/people-hub`
  - Proposals, Deliverables (direct links - part of nurture)
- **Settings** = Direct link (1 item)

### Sidebar Count
- **Sidebar**: ~14 links (cleaner, less overwhelming)
- **Hub pages**: Provide context and access to ~20+ spoke pages
- **Order**: Growth Ops → Attract → Engage → Nurture → Client Operations → Settings

### Client Operations Section ✅ IMPLEMENTED
- **Initiate Client Journey** (Rocket icon) - Hub at `/client-operations`
  - Welcome message: "Welcome to Ignite Client Operations - this is where all the pieces and parts you put in here lead a client through the journey to contract sign and then delivery. Ready to get going?"
  - Action card: "Set Your Proposal" → links to proposal wizard
  - Action card: "Invite Prospect to Portal" → links to contacts list
  - Shows recent proposals and contacts for quick access
  - Quick stats showing proposal counts (Total, Draft, Active, Approved)
- **Proposals** (FileCheck icon) - Direct link to proposals list
- **Deliverables** (FileText icon) - Direct link to deliverables
- **Portal Access Generation**: Available on contact detail pages (`/contacts/[contactId]`)
  - Button appears if contact has email
  - Generates Firebase password reset link
  - Copies link to clipboard automatically
  - Option to email link directly

### Core Principle: Attract → Engage → Nurture

The navigation flow follows the business development principle:

1. **ATTRACT** (Marketing & Branding)
   - Ads & SEO - Attract prospects through advertising
   - Content - Attract through content marketing
   - Branding Hub - Build brand awareness

2. **ENGAGE** (Outreach & Engagement)
   - Outreach Dashboard - Manage engagement campaigns
   - Campaigns - Email campaigns to engage prospects
   - Compose - Individual outreach emails
   - Meetings - 1:1 engagement
   - Events - Group engagement

3. **NURTURE** (Contacts & Relationships)
   - People Hub - Manage contacts and relationships
   - Deal Pipelines - Nurture through sales funnel
   - Proposals - Nurture client relationships
   - Deliverables - Deliver value to clients

### Engage Hub Structure (Proposed)

**Option A: Transform Existing Outreach Dashboard**
- Rename "Outreach Dashboard" to "Engage Hub"
- Keep route at `/outreach` (or rename to `/engage`)
- Add action cards section at top:
  - Campaigns → `/outreach/campaigns`
  - Compose → `/outreach/compose`
  - Meetings → `/meetings`
  - Events → `/events`
- Keep campaign metrics and recent campaigns below
- Single page, all engagement activities visible

**Option B: Create New Engage Hub Page**
- Create new `/engage` route
- Hub page with action cards for all engagement activities
- Keep `/outreach` as campaign-specific page
- More separation but more clicks

**Recommendation: Option A**
- Transform Outreach Dashboard into Engage Hub
- Add action cards for Meetings and Events
- Keep everything in one place
- Follows same pattern as People Hub

2. **Nurture Hub** (`/nurture`) - Optional
   - Show active proposals and deliverables
   - Contact relationship metrics
   - Pipeline overview
   - Links to People Hub, Proposals, Deliverables

3. **Attract Hub** (`/attract` or `/marketing`) - Optional
   - Marketing metrics overview
   - Campaign performance
   - Links to Ads & SEO, Content, Branding Hub
