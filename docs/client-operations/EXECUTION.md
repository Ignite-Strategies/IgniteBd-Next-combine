# Execution System

## Overview

The Execution page is a unified surface for managing work package execution. It's located at `/client-operations/execution` and provides a single UX for:

- Searching by Company
- Selecting Work Packages
- Viewing and editing Work Packages
- Managing Work Package Items
- Creating deliverables
- Tracking progress

## Current Implementation

### Page Location
- **Route**: `/client-operations/execution`
- **File**: `src/app/(authenticated)/client-operations/execution/page.jsx`
- **Component**: `ExecutionPage`

### Workflow

#### 1. Search by Company
- User types company name in search box
- System searches companies via `/api/companies?companyHQId=${id}&query=${term}`
- Results show company name and contact count
- User selects a company

#### 2. Auto-Load Work Packages
- After company selection, system automatically loads work packages
- API call: `/api/workpackages?companyHQId=${id}&contactCompanyId=${companyId}`
- If only one work package exists, it's auto-selected
- If multiple exist, user selects from dropdown

#### 3. Hydrate Work Package
- When work package is selected, system hydrates it
- API call: `/api/workpackages/${workPackageId}/hydrate`
- Returns full work package with:
  - Phases
  - Items
  - Artifacts
  - Timeline calculations
  - Company/contact relationships

#### 4. View and Edit Work Package
- **Header Section**: Shows title, description, company name
- **Edit Mode**: Can edit title and description inline
- **Priority Editor**: Text area for "Priorities this week"
- **Phases Section**: Shows all phases with items

#### 5. Manage Items
- Items show status, progress, and deliverable type
- Can update item status via dropdown
- Can click "Do this work item" to create deliverables
- Routes to appropriate builder based on deliverable type

## Key Features

### Company Search
- Real-time search as user types (300ms debounce)
- Filters by `companyHQId` (tenant boundary)
- Shows company name and contact count
- Clears work package selection when company changes

### Work Package Selection
- Dropdown selector after company is chosen
- Auto-selects if only one package exists
- Shows "No work packages found" if none exist
- Clears selection when company changes

### Work Package Hydration
- Uses `/api/workpackages/${id}/hydrate` endpoint
- Loads complete work package structure
- Includes phases, items, and calculated fields
- Updates local state for editing

### Priority Editor
- Text area for weekly priorities
- Saves via `PATCH /api/workpackages/${id}` with `prioritySummary`
- Shows "Saved" indicator after successful save
- Auto-clears indicator when user types

### Work Package Editing
- Inline editing of title and description
- Edit mode toggles on/off
- Saves via `PATCH /api/workpackages/${id}`
- Updates local state after save

### Item Status Management
- Status dropdown for each item
- Updates via `PATCH /api/workpackages/items/${itemId}`
- Reloads work package after status update
- Status options from `getStatusOptions(false)` (owner view)

### Deliverable Creation
- "Do this work item" button routes to builder
- Builder route determined by `deliverableType` or `itemType`
- Routes include `workPackageId` and `itemId` as query params
- Builder routes:
  - `blog` → `/builder/blog/new`
  - `persona` → `/builder/persona/new`
  - `page` / `landing_page` → `/builder/landingpage/new`
  - `deck` / `cledeck` → `/builder/cledeck/new`
  - `template` / `outreach_template` → `/builder/template/new`
  - `event` / `event_targets` → `/builder/event/new`

## Phases Section

The `PhasesSection` component displays:
- All phases for the work package
- Items within each phase
- Item status and progress
- Timeline information
- Actions for each item

### Phase Display
- Phase name and description
- Aggregated hours per phase
- Timeline status (on track, warning, overdue, complete)
- Expected end date calculations

### Item Display
- Item label and type
- Current status (not_started, in_progress, completed, etc.)
- Progress indicator (completed artifacts / total quantity)
- Estimated hours
- Deliverable type
- "Do this work item" button

## API Endpoints

### Company Search
```
GET /api/companies?companyHQId=${id}&query=${term}
Response: { success: true, companies: [...] }
```

### Load Work Packages
```
GET /api/workpackages?companyHQId=${id}&contactCompanyId=${companyId}
Response: { success: true, workPackages: [...] }
```

### Hydrate Work Package
```
GET /api/workpackages/${workPackageId}/hydrate
Response: { success: true, workPackage: { ... } }
```

### Update Work Package
```
PATCH /api/workpackages/${workPackageId}
Body: { title?, description?, prioritySummary?, effectiveStartDate? }
Response: { success: true, workPackage: { ... } }
```

### Update Item Status
```
PATCH /api/workpackages/items/${itemId}
Body: { status: string }
Response: { success: true, item: { ... } }
```

## Data Flow

```
1. User navigates to /client-operations/execution
   ↓
2. Page loads, gets companyHQId from localStorage
   ↓
3. User types company name → Search companies API
   ↓
4. User selects company → Auto-load work packages
   ↓
5. User selects work package → Hydrate work package
   ↓
6. Work package displays with phases and items
   ↓
7. User can:
   - Edit title/description
   - Update priorities
   - Change item status
   - Create deliverables (routes to builder)
```

## State Management

### Local State
- `companyHQId` - From localStorage
- `companySearchTerm` - User input
- `companyResults` - Search results
- `selectedCompany` - Selected company
- `workPackages` - List of packages for company
- `selectedWorkPackage` - Selected package (id + title)
- `workPackage` - Full hydrated work package data
- `prioritySummary` - Priority text
- `wpTitle`, `wpDescription` - Edit fields
- `updatingStatus` - Map of item IDs being updated

### Loading States
- `loadingPackages` - Loading work packages list
- `loading` - Loading/hydrating work package
- `savingPriority` - Saving priority summary
- `savingWP` - Saving work package edits
- `updatingStatus` - Updating item status

## Builder Route Mapping

The `getBuilderRoute()` function maps deliverable types to builder routes:

```javascript
const typeMap = {
  blog: '/builder/blog',
  persona: '/builder/persona',
  page: '/builder/landingpage',
  landing_page: '/builder/landingpage',
  deck: '/builder/cledeck',
  cledeck: '/builder/cledeck',
  template: '/builder/template',
  outreach_template: '/builder/template',
  event: '/builder/event',
  event_targets: '/builder/event',
};
```

Routes are built as: `${baseRoute}/new?workPackageId=${id}&itemId=${itemId}`

## WorkPackage Association

### Current Schema
- WorkPackage has `contactId` (required)
- WorkPackage has `companyId` (optional, legacy?)
- Contact has `contactCompanyId` (optional)
- WorkPackage can access company via `contact.contactCompany`

### Filtering
- Work packages filtered by `contactCompanyId` (direct company link)
- Also filtered by `companyHQId` (tenant boundary)
- API supports both filters in query params

### Issues & Considerations
- No direct `contactCompanyId` on WorkPackage (must go through contact)
- API tries to include `contactCompany` directly but schema may not support it
- Filtering by contactCompany requires join through contact relationship

## Best Practices

1. **Always set `effectiveStartDate`** on WorkPackage for accurate timeline calculations
2. **Use consistent deliverable types** for proper builder routing
3. **Update item status** as work progresses
4. **Link artifacts** to items for progress tracking
5. **Review priorities** regularly and update weekly

## Future Enhancements

- [ ] Work package search (not just company search)
- [ ] Bulk item status updates
- [ ] Drag-and-drop item reordering
- [ ] Timeline visualization
- [ ] Notifications for overdue items
- [ ] Export execution reports
- [ ] Filter by phase or status

---

**Last Updated**: November 2025  
**Status**: Current Implementation  
**Route**: `/client-operations/execution`  
**Component**: `ExecutionPage`
