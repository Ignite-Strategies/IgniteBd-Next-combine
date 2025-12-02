# Blog Architecture

Complete architecture guide for the Blog system in IgniteBD.

## Table of Contents

1. [Overview](#overview)
2. [Blog Prisma Model](#blog-prisma-model)
3. [Blog Engine Types](#blog-engine-types)
4. [API Routes](#api-routes)
5. [UI Pages & Flows](#ui-pages--flows)
6. [AI Generation Flow](#ai-generation-flow)
7. [Data Flow](#data-flow)
8. [Build Options](#build-options)
9. [ContentHub Integration](#contenthub-integration)

---

## Overview

The Blog system is a **ContentHub-only** content management system designed to create, manage, and edit blog posts. It operates independently of WorkPackage/WorkCollateral logic and focuses on standalone blog artifacts.

**Key Principles:**
- ✅ ContentHub-only (no WorkPackage dependencies)
- ✅ Multi-tenant (scoped by `companyHQId`)
- ✅ AI-powered generation from personas
- ✅ Simple text-based editing (`blogText`)
- ✅ Structured sections stored separately for future editing

---

## Blog Prisma Model

**File:** `prisma/schema.prisma`

```prisma
model Blog {
  id          String    @id @default(cuid())
  companyHQId String
  companyHQ   CompanyHQ @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  title       String
  subtitle    String?
  blogText    String?   // Merged content from sections
  sections    Json?     // Structured BlogDraft for future editing
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([companyHQId])
  @@map("blogs")
}
```

### Field Descriptions

- **`id`**: Unique identifier (cuid)
- **`companyHQId`**: Tenant boundary (required)
- **`title`**: Blog title (required)
- **`subtitle`**: Optional subtitle
- **`blogText`**: Merged markdown/text content from sections
- **`sections`**: JSON structure storing full `BlogDraft` for future structured editing
- **`createdAt`**: Creation timestamp
- **`updatedAt`**: Last update timestamp

### Key Design Decisions

1. **Dual Storage**: `blogText` (flat) + `sections` (structured)
   - `blogText`: Simple textarea editing
   - `sections`: Preserves AI-generated structure for future enhancements

2. **ContentHub-Only**: No WorkPackage/WorkCollateral relationships
   - Blogs are standalone content artifacts
   - Managed through `/content/blog` routes

---

## Blog Engine Types

**File:** `src/lib/blog-engine/types.ts`

### BlogIngest

Input structure for AI blog generation:

```typescript
export type BlogIngest = {
  mode: "persona";
  personaId: string;
  persona: any; // Full persona object
  topic: string; // User-provided core theme
  problem: string; // BD challenge the blog addresses
  angle?: string; // Optional: efficiency, dealmaking, risk
  targetLength?: number; // Defaults to 500-700 words
  companyHQId: string;
};
```

**Example:**
```json
{
  "mode": "persona",
  "personaId": "clx123...",
  "persona": { "name": "Solo Biz Owner", "title": "Sole Proprietor", ... },
  "topic": "Private credit NDAs",
  "problem": "NDAs kill deal momentum",
  "targetLength": 600,
  "companyHQId": "clx456..."
}
```

### BlogDraft

AI-generated blog structure:

```typescript
export type BlogDraft = {
  title: string;
  subtitle?: string;
  outline: {
    sections: {
      heading: string;
      bullets: string[];
    }[];
  };
  body: {
    sections: {
      heading: string;
      content: string; // 2-3 rich paragraphs per section
    }[];
  };
  summary?: string;
  cta?: string;
};
```

**Structure:**
- **`outline`**: Section headings with bullet points
- **`body`**: Full content sections with headings and paragraphs
- **`summary`**: Optional blog summary
- **`cta`**: Call-to-action text

---

## API Routes

### ContentHub Blog Routes

#### POST `/api/content/blog`
Create a new blog.

**Request Body:**
```json
{
  "companyHQId": "clx123...",
  "title": "Blog Title",
  "subtitle": "Optional subtitle",
  "blogText": "Optional direct text",
  "sections": { /* BlogDraft structure */ },
  "blogDraft": { /* BlogDraft from AI */ }
}
```

**Processing:**
- If `blogDraft` provided: Merges `body.sections` into `blogText`
- Stores `blogDraft` as `sections` JSON
- Creates Blog record

**Response:**
```json
{
  "success": true,
  "blog": { /* Blog record */ }
}
```

#### GET `/api/content/blog`
List blogs for a companyHQ.

**Query Params:**
- `companyHQId` (required): Tenant identifier

**Response:**
```json
{
  "success": true,
  "blogs": [ /* Blog[] */ ]
}
```

#### GET `/api/content/blog/[id]`
Get a single blog.

**Response:**
```json
{
  "success": true,
  "blog": { /* Blog record */ }
}
```

#### PATCH `/api/content/blog/[id]`
Update a blog.

**Request Body:**
```json
{
  "title": "Updated title",
  "subtitle": "Updated subtitle",
  "blogText": "Updated content",
  "sections": { /* Updated BlogDraft */ }
}
```

**Response:**
```json
{
  "success": true,
  "blog": { /* Updated Blog record */ }
}
```

#### DELETE `/api/content/blog/[id]`
Delete a blog.

**Response:**
```json
{
  "success": true,
  "message": "Blog deleted successfully"
}
```

### AI Generation Route

#### POST `/api/workme/blog/ai`
Generate blog content from BlogIngest.

**Request Body:**
```json
{
  "blogIngest": {
    "mode": "persona",
    "personaId": "clx123...",
    "persona": { /* Persona object */ },
    "topic": "Private credit NDAs",
    "problem": "NDAs kill deal momentum",
    "targetLength": 600,
    "companyHQId": "clx456..."
  }
}
```

**Process:**
1. Validates `blogIngest` structure
2. Builds GPT prompt with persona context
3. Calls OpenAI GPT-4o with JSON response format
4. Parses and validates `BlogDraft` structure
5. Returns `BlogDraft`

**Response:**
```json
{
  "success": true,
  "blogDraft": {
    "title": "Generated Title",
    "subtitle": "Generated Subtitle",
    "outline": { /* Outline structure */ },
    "body": { /* Body structure */ },
    "summary": "Generated summary",
    "cta": "Generated CTA"
  }
}
```

---

## UI Pages & Flows

### Blog Landing Page
**Route:** `/content/blog`

**Features:**
- Build option cards (4 options)
- Existing blogs list
- Sync button for refresh

**Build Options:**
1. **Build from Persona** → `/content/blog/build/persona`
2. **Build from Idea** → `/content/blog/build/idea`
3. **Build from Previous Blog** → `/content/blog/build/previous`
4. **Start Empty** → `/content/blog/build/write`

### Build from Persona
**Route:** `/content/blog/build/persona`

**Flow:**
1. **Persona Selector**
   - Loads personas from `/api/personas?companyHQId=...`
   - Displays: `persona.name`, `persona.title`, top 3 problems (as bullets)
   - Radio button selection

2. **Topic Input**
   - Text input for core theme
   - Example: "Private credit NDAs"

3. **Problem Input**
   - Textarea for BD challenge
   - Example: "NDAs kill deal momentum"

4. **Generate Button**
   - Creates `BlogIngest` object
   - Calls `POST /api/workme/blog/ai`
   - Receives `BlogDraft`
   - Calls `POST /api/content/blog` with `blogDraft`
   - Redirects to `/content/blog/[id]`

### Blog Detail/Editor Page
**Route:** `/content/blog/[id]`

**Features:**
- Editable fields:
  - `title` (required)
  - `subtitle` (optional)
  - `blogText` (main content, textarea)
- Save button → `PATCH /api/content/blog/[id]`
- Delete button → `DELETE /api/content/blog/[id]`
- Back to `/content/blog`

**Note:** `sections` stored separately for future structured editing enhancements.

---

## AI Generation Flow

### Complete Flow Diagram

```
User Input (Persona + Topic + Problem)
  ↓
BlogIngest Object
  ↓
POST /api/workme/blog/ai
  ↓
OpenAI GPT-4o (JSON mode)
  ↓
BlogDraft Response
  ↓
POST /api/content/blog
  ↓
Merge body.sections → blogText
Store blogDraft → sections
  ↓
Blog Record Created
  ↓
Redirect to /content/blog/[id]
```

### AI Prompt Structure

The AI route builds a structured prompt:

1. **Context**: BusinessPoint Law BD content strategist role
2. **Input**: Full `BlogIngest` JSON
3. **Instructions**:
   - Target length (500-700 words default)
   - Professional BD audience
   - Persona-anchored pain points
   - Structured output (title, subtitle, outline, body, summary, CTA)
4. **Output Format**: JSON matching `BlogDraft` type

### Section Merging Logic

When `blogDraft` is received:

```javascript
// Merge body sections into blogText
finalBlogText = blogDraft.body.sections
  .map((section) => {
    const heading = section.heading ? `## ${section.heading}\n\n` : '';
    return heading + (section.content || '');
  })
  .join('\n\n');

// Store full BlogDraft as sections
finalSections = blogDraft;
```

**Result:**
- `blogText`: Flat markdown-ready text
- `sections`: Full structured `BlogDraft` for future editing

---

## Data Flow

### Creation Flow

```
1. User selects persona, enters topic/problem
   ↓
2. Frontend creates BlogIngest
   ↓
3. POST /api/workme/blog/ai
   - Validates BlogIngest
   - Calls OpenAI
   - Returns BlogDraft
   ↓
4. POST /api/content/blog
   - Merges BlogDraft.body.sections → blogText
   - Stores BlogDraft → sections
   - Creates Blog record
   ↓
5. Redirect to /content/blog/[id]
```

### Editing Flow

```
1. User opens /content/blog/[id]
   ↓
2. GET /api/content/blog/[id]
   - Returns Blog with blogText and sections
   ↓
3. User edits title, subtitle, blogText
   ↓
4. PATCH /api/content/blog/[id]
   - Updates Blog fields
   - Preserves sections JSON
   ↓
5. Redirect to /content/blog
```

### Listing Flow

```
1. User opens /content/blog
   ↓
2. GET /api/content/blog?companyHQId=...
   - Returns Blog[] ordered by createdAt DESC
   ↓
3. Display cards with title, subtitle, createdAt
   ↓
4. Click → Navigate to /content/blog/[id]
```

---

## Build Options

### 1. Build from Persona ✅
**Route:** `/content/blog/build/persona`

**Status:** Fully implemented

**Features:**
- Persona selector with problems display
- Topic and problem inputs
- AI generation via BlogIngest

### 2. Build from Idea 🚧
**Route:** `/content/blog/build/idea`

**Status:** Placeholder (needs implementation)

**Planned:**
- Core idea input
- AI generation without persona

### 3. Build from Previous Blog 🚧
**Route:** `/content/blog/build/previous`

**Status:** Placeholder (needs implementation)

**Planned:**
- Select existing blog
- Use as template/base

### 4. Start Empty 🚧
**Route:** `/content/blog/build/write`

**Status:** Placeholder (needs implementation)

**Planned:**
- Empty editor
- Manual writing

---

## ContentHub Integration

### ContentHub Route Structure

```
/content/blog                    # Landing page
/content/blog/build/persona     # Build from persona ✅
/content/blog/build/idea        # Build from idea 🚧
/content/blog/build/previous    # Build from previous 🚧
/content/blog/build/write       # Start empty 🚧
/content/blog/[id]              # Blog editor ✅
```

### ContentHub Principles

1. **Standalone Artifacts**: Blogs are independent content pieces
2. **No WorkPackage Logic**: No WorkPackage/WorkCollateral relationships
3. **Multi-Tenant**: All blogs scoped by `companyHQId`
4. **Simple Editing**: Focus on `blogText` for user editing
5. **Structured Storage**: `sections` preserved for future enhancements

### Related ContentHub Systems

- **Templates**: `/content/templates` (email/SMS templates)
- **Presentations**: `/content/presentations` (presentation decks)
- **Landing Pages**: `/content/landing-pages` (landing page builder)

---

## Current Status

### ✅ Completed

- Blog Prisma model (`blogText` + `sections`)
- ContentHub API routes (`/api/content/blog`)
- Blog landing page with build options
- Build from Persona flow
- AI generation route (`/api/workme/blog/ai`)
- Blog detail/editor page
- Section merging logic

### 🚧 In Progress / Planned

- Build from Idea flow
- Build from Previous Blog flow
- Start Empty flow
- Structured section editing UI
- Blog publishing workflow
- Blog analytics

### 📋 Future Enhancements

- Multiple generation modes (idea, previous, etc.)
- Rich text editor for `blogText`
- Section-based editing UI
- Blog preview
- SEO optimization
- Content scheduling
- Blog categories/tags

---

## Related Documentation

- **ContentHub UX Map**: `docs/content/ContentHub_UX_Map.md`
- **Architecture Overview**: `docs/architecture/ignitebd-architectureoverview.md`
- **Personas Architecture**: `docs/personas-parser/PERSONA_ARCHITECTURE.md`

---

**Last Updated**: December 2024  
**Status**: Core Blog Model ✅ | Build Options 🚧  
**Architecture**: ContentHub-Only  
**Multi-Tenancy**: CompanyHQ-scoped  
**AI Integration**: OpenAI GPT-4o

