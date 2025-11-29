# Content Hub Product Outputs Architecture

**Last Updated:** 2025-01-27  
**Status:** Current Implementation

---

## 🎯 EXECUTIVE SUMMARY

The Content Hub (`/content`) is the central location for managing **product outputs** - standalone content artifacts like presentations (decks), blogs, templates, event plans, and landing pages. These artifacts are created and stored independently, then linked to work packages via the `WorkCollateral` model when they're delivered to clients.

**Key Concept:** Product outputs are **standalone artifacts** that live in the Content Hub, separate from work packages. They become "deliverables" when linked to work packages via `WorkCollateral`.

---

## 📦 CORE ARCHITECTURE

### 1. Content Hub Structure

```
/content                          # Content Hub landing page
  ├── /presentations              # Presentation (deck) management
  │   ├── /build                  # AI-powered creation flow
  │   └── /ai                     # AI outline generation
  ├── /blog                       # Blog management (coming soon)
  └── /[other-types]              # Other content types
```

### 2. Presentation Model (The "Deck" Item)

**Location:** `prisma/schema.prisma` (lines 797-814)

```prisma
model Presentation {
  id          String    @id @default(cuid())
  companyHQId String
  companyHQ   CompanyHQ @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  title       String
  slides      Json?    // Array of slide objects with sections
  presenter   String?
  description String?
  feedback    Json?    // JSON map: { "0": "...", "5": "...", "7": "..." } - feedback keyed by sectionIndex
  published   Boolean   @default(false)
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([companyHQId])
  @@index([published])
  @@map("presentations")
}
```

**Key Characteristics:**
- ✅ **Standalone artifact** - Lives at `CompanyHQ` level (tenant-scoped)
- ✅ **Content storage** - Full presentation content stored in `slides` JSON field
- ✅ **Publishing workflow** - `published` flag controls visibility
- ✅ **Feedback system** - `feedback` JSON stores section-level client feedback
- ✅ **No direct work package link** - Linked via `WorkCollateral` (see below)

### 3. WorkCollateral Model (Client Deliverables - Snapshot Storage)

**Location:** `prisma/schema.prisma` (lines 689-713)

```prisma
model WorkCollateral {
  id                String           @id @default(cuid())
  workPackageId     String?
  workPackage       WorkPackage?     @relation(fields: [workPackageId], references: [id], onDelete: Cascade)
  workPackageItemId String?
  workPackageItem   WorkPackageItem? @relation(fields: [workPackageItemId], references: [id], onDelete: Cascade)

  type        String // BLOG | PERSONA | PRESENTATION_DECK | TEMPLATE | ETC
  title       String?
  contentJson Json?  // STORES FULL SNAPSHOT COPY OF CONTENT (not a reference)

  status WorkCollateralStatus @default(IN_PROGRESS)

  reviewRequestedAt DateTime?
  reviewCompletedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([workPackageId])
  @@index([workPackageItemId])
  @@index([status])
  @@index([type])
  @@map("work_collateral")
}
```

**Key Characteristics:**
- ✅ **Client deliverable storage** - Contains snapshot copies of content for client delivery
- ✅ **NO FK relations** - **MUST NOT** have foreign keys to Presentation, Blog, Template, etc.
- ✅ **Type field** - `PRESENTATION_DECK` or `CLE_DECK` for presentations
- ✅ **Snapshot storage** - `contentJson` stores **FULL SNAPSHOT COPY** of the content (e.g., `{ title, slides, presenter, description, feedback }`)
- ✅ **Review workflow** - Status tracking for client review process
- ✅ **Optional links** - Can link to `WorkPackage` or `WorkPackageItem` (or both)
- ⚠️ **CRITICAL**: WorkCollateral and Content Hub artifacts are **separate universes** - no relational links

### 4. Work Package Item Model

**Location:** `prisma/schema.prisma` (lines 653-687)

```prisma
model WorkPackageItem {
  id                 String           @id @default(cuid())
  workPackageId      String
  workPackage        WorkPackage      @relation(...)
  workPackagePhaseId String
  workPackagePhase   WorkPackagePhase @relation(...)

  deliverableType        String  // PRESENTATION_DECK, BLOG, etc.
  deliverableLabel       String
  deliverableDescription String?

  quantity           Int
  unitOfMeasure      String
  estimatedHoursEach Int
  status             WorkPackageItemStatus @default(NOT_STARTED)

  workCollateral WorkCollateral[]  // Links to actual artifacts

  createdAt DateTime @default(now())
  
  @@map("work_package_items")
}
```

**Key Characteristics:**
- ✅ **Deliverable definition** - Defines what needs to be delivered (`deliverableType: PRESENTATION_DECK`)
- ✅ **Quantity tracking** - Can specify how many decks are needed
- ✅ **Status tracking** - Tracks progress (NOT_STARTED, IN_PROGRESS, etc.)
- ✅ **Links to artifacts** - `workCollateral` relation connects to actual `Presentation` artifacts

---

## 🔄 PRODUCT OUTPUTS FLOW

### Flow 1: Creating a Presentation in Content Hub

```
1. User navigates to /content
2. Clicks "Presentations" card
3. Clicks "Build Presentation" button
4. Goes to /content/presentations/build
5. User enters idea and slide count
6. AI generates outline via /api/workme/presentations/outline-ai
7. User reviews/edits outline
8. Saves to database via POST /api/content/presentations
9. Presentation created in database (standalone)
10. Saved to localStorage for instant hydration
11. Redirects to /content/presentations (home page)
```

**API Endpoints:**
- `POST /api/workme/presentations/outline-ai` - AI outline generation
- `POST /api/content/presentations` - Create presentation
- `GET /api/content/presentations?companyHQId=...` - List presentations
- `GET /api/content/presentations/[id]` - Get single presentation
- `PATCH /api/content/presentations/[id]` - Update presentation
- `DELETE /api/content/presentations/[id]` - Delete presentation

### Flow 2: Linking Presentation to Work Package (Snapshot Copy)

```
1. Consultant creates WorkPackageItem with deliverableType: PRESENTATION_DECK
2. Consultant navigates to work package item detail page
3. Clicks "Create" or "Link" button
4. Can either:
   a) Create new deliverable directly (blank WorkCollateral with empty contentJson)
   b) Link existing presentation from content hub (COPY snapshot)
5. If linking from Content Hub:
   - Load Presentation from Content Hub table
   - DO NOT create new Presentation
   - DO NOT use FK relation
   - COPY full content into WorkCollateral.contentJson:
     {
       workPackageItemId: "...",
       workPackageId: "...",
       type: "PRESENTATION_DECK",
       title: "Presentation Title",
       contentJson: {
         title: "Presentation Title",
         slides: [...],
         presenter: "...",
         description: "...",
         feedback: {}
       },
       status: "IN_PROGRESS"
     }
6. WorkCollateral now contains full snapshot copy
7. Client can review via portal (reads from WorkCollateral.contentJson)
```

**API Endpoints:**
- `POST /api/presentations/duplicate` - Copy presentation content into WorkCollateral snapshot
- `GET /api/portal/review/presentation` - Get presentation from WorkCollateral.contentJson
- `POST /api/portal/review/cle/feedback` - Save client feedback to WorkCollateral.contentJson

### Flow 3: Client Review Process

```
1. Client logs into portal
2. Views work package item with linked presentation
3. Clicks "Review" button
4. System loads presentation from WorkCollateral:
   - Finds WorkCollateral with type: PRESENTATION_DECK
   - Loads contentJson directly (this IS the presentation snapshot)
   - NO FK lookup to Presentation table
5. Client views presentation outline from WorkCollateral.contentJson
6. Client provides feedback on specific sections
7. Feedback saved to WorkCollateral.contentJson.feedback (updates snapshot)
8. WorkCollateral.status updated to IN_REVIEW or CHANGES_NEEDED
```

---

## 🏗️ DATA MODEL RELATIONSHIPS

### CompanyHQ → Presentation (One-to-Many)

```
CompanyHQ
  ├── presentations Presentation[]
  └── (tenant boundary - all presentations scoped to company)
```

**Purpose:** All presentations belong to a `CompanyHQ` (tenant isolation)

### WorkPackage → WorkCollateral (Snapshot Storage)

```
WorkPackage
  ├── items WorkPackageItem[]
  │   └── workCollateral WorkCollateral[]
  │       └── contentJson: { title, slides, presenter, description, feedback }
  │           └── (FULL SNAPSHOT COPY - no FK to Presentation)
```

**Purpose:** 
- Work packages define deliverables (`WorkPackageItem`)
- `WorkCollateral` stores **snapshot copies** of content for client delivery
- **NO relational links** between WorkCollateral and Content Hub artifacts

### Key Design Principle: **Separate Universes**

**Content Hub Artifacts** (Ignite-owned, reusable):
- Standalone artifacts in Presentation, Blog, Template tables
- Created and managed in `/content/*` routes
- Reusable across multiple clients
- **NEVER relationally linked to WorkCollateral**

**WorkCollateral** (Client deliverables, snapshots):
- Contains **snapshot copies** of content in `contentJson`
- Created when linking Content Hub artifacts or creating client-specific content
- Client edits update the snapshot, not the original Content Hub artifact
- **NO FK relations** to Content Hub artifacts

This separation allows:
- ✅ Content Hub artifacts remain evergreen and reusable
- ✅ Client-specific edits don't affect original templates
- ✅ Multiple clients can have different versions of the same content
- ✅ Clear separation between reusable content and client deliverables

---

## 📁 FILE STRUCTURE

### Content Hub Pages

```
src/app/(authenticated)/content/
  ├── page.jsx                    # Content Hub landing page
  └── presentations/
      ├── page.jsx                # Presentations list/home page
      ├── build/
      │   └── page.jsx            # AI-powered creation flow
      └── ai/
          └── page.jsx            # AI outline generation UI
```

### Builder Pages

```
src/app/(authenticated)/builder/
  └── presentation/
      └── [id]/
          └── page.jsx            # Presentation builder/editor
```

### API Routes

```
src/app/api/
  ├── content/
  │   └── presentations/
  │       ├── route.js            # POST (create), GET (list)
  │       └── [id]/
  │           └── route.js        # GET, PATCH, DELETE
  ├── workme/
  │   └── presentations/
  │       └── outline-ai/
  │           └── route.ts        # AI outline generation
  └── presentations/
      └── duplicate/
          └── route.js            # Duplicate into work package
```

---

## 🔑 KEY CONCEPTS

### 1. Product Outputs vs Deliverables

**Product Outputs** (Content Hub):
- Standalone artifacts stored in Content Hub
- Examples: `Presentation`, `Blog`, `Template`, `EventPlan`, `LandingPage`
- Created and managed independently
- Scoped to `CompanyHQ` (tenant)

**Deliverables** (Work Packages):
- Work items defined in `WorkPackageItem`
- Examples: `deliverableType: PRESENTATION_DECK`
- Define what needs to be delivered
- Linked to actual artifacts via `WorkCollateral`

**Relationship:**
```
Product Output (Presentation) ← WorkCollateral → Deliverable (WorkPackageItem)
```

### 2. Content Hub as Repository

The Content Hub (`/content`) serves as:
- ✅ **Central repository** for all content artifacts
- ✅ **Management interface** for creating/editing content
- ✅ **Discovery surface** for finding existing content
- ✅ **Standalone workspace** independent of work packages

### 3. WorkCollateral as Bridge

`WorkCollateral` serves as:
- ✅ **Link** between work packages and artifacts
- ✅ **Review workflow** tracking (status, feedback)
- ✅ **Reference storage** (stores artifact ID in `contentJson`)
- ✅ **Delivery context** (which artifact is delivered to which client)

### 4. Presentation Structure

**Slides JSON Format:**
```json
{
  "slides": [
    {
      "sectionIndex": 0,
      "title": "Section Title",
      "bullets": ["Point 1", "Point 2", "Point 3"]
    },
    {
      "sectionIndex": 1,
      "title": "Next Section",
      "bullets": ["Point A", "Point B"]
    }
  ]
}
```

**Feedback JSON Format:**
```json
{
  "feedback": {
    "0": "Great opening, but add more context",
    "5": "This section needs more detail",
    "7": "Perfect!"
  }
}
```

---

## 🎨 USER EXPERIENCE FLOWS

### Flow A: Content Hub → Create Presentation

1. **Landing Page** (`/content`)
   - Shows "Presentations" card
   - Click navigates to `/content/presentations`

2. **Presentations List** (`/content/presentations`)
   - Lists all presentations (hydrated from localStorage)
   - "Build Presentation" button
   - Sync button to refresh from database
   - View/Edit/Delete actions per presentation

3. **Build Flow** (`/content/presentations/build`)
   - Form: idea input, slide count
   - AI generation via `/api/workme/presentations/outline-ai`
   - Review/edit generated outline
   - Save creates `Presentation` in database
   - Redirects to `/content/presentations`

4. **Builder** (`/builder/presentation/[id]`)
   - Full editor for presentation content
   - Save updates database + localStorage
   - Redirects to `/content/presentations`

### Flow B: Work Package → Link Presentation

1. **Work Package Item Detail**
   - Shows deliverable: "PRESENTATION_DECK"
   - "Create" or "Link" button

2. **Create from Work Package**
   - Creates new `Presentation` in Content Hub
   - Creates `WorkCollateral` linking to work item
   - Opens builder for editing

3. **Link Existing Presentation**
   - Shows list of existing presentations
   - Select presentation
   - Creates `WorkCollateral` linking to work item

4. **Client Review**
   - Client views presentation via portal
   - Provides feedback on sections
   - Feedback saved to `Presentation.feedback`
   - Status updated in `WorkCollateral`

---

## 🔍 QUERY PATTERNS

### Get All Presentations for Company

```typescript
const presentations = await prisma.presentation.findMany({
  where: { companyHQId },
  orderBy: { createdAt: 'desc' }
});
```

### Get Presentation Linked to Work Item

```typescript
// Find WorkCollateral
const collateral = await prisma.workCollateral.findFirst({
  where: {
    workPackageItemId,
    type: 'PRESENTATION_DECK'
  }
});

// WorkCollateral.contentJson IS the presentation snapshot
// No FK lookup needed - the content is already in contentJson
const presentation = collateral.contentJson as any;
// presentation contains: { title, slides, presenter, description, feedback }
```

### Get All Work Items with Presentations

```typescript
const workItems = await prisma.workPackageItem.findMany({
  where: {
    deliverableType: 'PRESENTATION_DECK'
  },
  include: {
    workCollateral: {
      where: { type: 'PRESENTATION_DECK' }
    }
  }
});
```

---

## 📊 STATUS WORKFLOW

### Presentation Status

- `published: false` → Draft (default)
- `published: true` → Published (visible to clients)

### WorkCollateral Status

- `NOT_STARTED` → Not yet created
- `IN_PROGRESS` → Being worked on
- `IN_REVIEW` → Sent to client for review
- `CHANGES_NEEDED` → Client requested changes
- `CHANGES_IN_PROGRESS` → Changes being made
- `APPROVED` → Client approved

---

## 🚀 FUTURE ENHANCEMENTS

### Planned Features

1. **Blog Management**
   - Similar flow to presentations
   - `/content/blog` page
   - AI-powered blog generation

2. **Content Analytics**
   - Views, engagement metrics
   - Performance tracking

3. **Content Templates**
   - Reusable presentation templates
   - Template library

4. **Version Control**
   - Track changes over time
   - Revert to previous versions

5. **Content Calendar**
   - Schedule publishing
   - Content planning

---

## 📝 SUMMARY

**Content Hub Product Outputs Architecture:**

1. **Content Hub Artifacts** - Standalone, reusable content (Presentation, Blog, Template, etc.)
   - Live in Content Hub (`/content/*`)
   - Stored in Presentation, Blog, Template tables
   - Ignite-owned, evergreen, reusable
   - **NO FK relations to WorkCollateral**

2. **WorkCollateral** - Client deliverable snapshots
   - Contains **full snapshot copies** in `contentJson`
   - Created when linking Content Hub artifacts or creating client-specific content
   - Client edits update snapshot, not original
   - **NO FK relations to Content Hub artifacts**

3. **Separate Universes** - Content Hub and WorkCollateral are completely separate
   - Linking = copying content into WorkCollateral snapshot
   - Reading = loading from WorkCollateral.contentJson directly
   - No relational links between the two systems

4. **Review Workflow** - Client feedback stored in WorkCollateral.contentJson.feedback
   - Status tracking on WorkCollateral
   - Content Hub artifacts remain unchanged

5. **Tenant Isolation** - All content scoped to CompanyHQ

**Key Files:**
- `prisma/schema.prisma` - Presentation and WorkCollateral models
- `src/app/(authenticated)/content/` - Content Hub pages
- `src/app/api/content/presentations/` - Presentation API routes
- `src/app/api/presentations/duplicate/` - Work package linking

**Key Models:**
- `Presentation` - The "deck" artifact
- `WorkCollateral` - Bridge between artifacts and work packages
- `WorkPackageItem` - Deliverable definition

---

**Related Documentation:**
- [Content Hub UX Map](./ContentHub_UX_Map.md)
- [PresentationMD Pattern](./PRESENTATIONMD.md)
- [Work Package System](../client-operations/work-packages/WORK_PACKAGE_SYSTEM.md)

