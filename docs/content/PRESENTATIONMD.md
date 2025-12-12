# PresentationMD - Standardized AI Content Builder Pattern

## Overview

This document defines the standard pattern for building AI-powered content creation flows in IgniteBD. The "PresentationMD" pattern ensures consistency, reliability, and maintainability across all content types.

## Core Pattern: Build with AI Flow

### Standard Flow

```
1. User Input → 2. OpenAI Call → 3. Return Structured Data → 4. View/Edit → 5. Save → 6. Home
```

### Implementation Steps

#### 1. User Input Page (`/content/[type]/ai/page.jsx`)

**Requirements:**
- Simple form with required inputs (e.g., idea, count, etc.)
- Number inputs must allow typing (not just arrows)
- Clear validation before API call
- Loading state during generation

**Example Structure:**
```jsx
const [idea, setIdea] = useState('');
const [slideCount, setSlideCount] = useState(6);
const [generating, setGenerating] = useState(false);

const handleGenerate = async () => {
  // Validate inputs
  // Call AI endpoint
  // Store response in state
};
```

#### 2. AI Endpoint (`/api/workme/[type]/[action]-ai/route.ts`)

**Standard Response Format:**
```json
{
  "success": true,
  "title": "AI-generated title",
  "description": "AI-generated description",
  "outline": [
    {
      "title": "Section title",
      "bullets": ["point 1", "point 2"]
    }
  ]
}
```

**Requirements:**
- Always return `title` and `description` (not just outline)
- Use structured JSON response format
- Include fallbacks if AI doesn't return expected fields
- Proper error handling

#### 3. View/Edit Page (`/content/[type]/ai/page.jsx` - after generation)

**Requirements:**
- Show editable title and description fields
- Display generated outline in editable format
- Allow user to modify before saving
- Clear "Save & Create" button

**State Management:**
```jsx
const [aiTitle, setAiTitle] = useState('');
const [aiDescription, setAiDescription] = useState('');
const [outline, setOutline] = useState([]);
```

#### 4. Save Flow

**Requirements:**
- Save to database via `/api/content/[type]`
- Save to localStorage with key: `[type]_${companyHQId}`
- Redirect to home page (`/content/[type]`)
- Show success feedback (inline or toast)

**Save Function:**
```jsx
const handleSave = async () => {
  const response = await api.post('/api/content/[type]', {
    companyHQId,
    title: aiTitle,
    description: aiDescription,
    content: outline, // or appropriate structure
  });
  
  // Save to localStorage
  // Redirect to home
};
```

#### 5. Home Page (`/content/[type]/page.jsx`)

**Requirements:**
- Hydrate from localStorage first (instant load)
- Fetch from API in background
- Update localStorage with fresh data
- Show title, description, View/Edit/Delete buttons
- Sync button to force refresh

**Hydration Pattern:**
```jsx
const loadItems = async (forceRefresh = false) => {
  // Load from localStorage if not forcing
  if (!forceRefresh) {
    const cached = localStorage.getItem(`[type]_${companyHQId}`);
    if (cached) {
      setItems(JSON.parse(cached));
      setLoading(false);
    }
  }
  
  // Always fetch fresh from API
  const response = await api.get(`/api/content/[type]?companyHQId=${companyHQId}`);
  setItems(response.data.items);
  
  // Update localStorage
  localStorage.setItem(`[type]_${companyHQId}`, JSON.stringify(response.data.items));
};
```

#### 6. Builder Page (`/builder/[type]/[id]/page.jsx`)

**Requirements:**
- Load all fields properly (handle JSON strings vs objects)
- Show proper UI (not raw JSON)
- Save to database + localStorage
- Redirect to home on save
- Inline success message

**Loading Pattern:**
```jsx
const loadItem = async () => {
  const response = await api.get(`/api/content/[type]/${id}`);
  const item = response.data.item;
  
  // Handle all field types properly
  setTitle(item.title || '');
  setDescription(item.description || '');
  
  // Handle JSON fields
  let contentData = {};
  if (item.content) {
    if (typeof item.content === 'string') {
      contentData = JSON.parse(item.content);
    } else {
      contentData = item.content;
    }
  }
  setContent(contentData);
};
```

## Standard API Routes

### Content Type Routes

**Pattern:** `/api/content/[type]`

**Methods:**
- `POST` - Create new item
- `GET` - List items (with `companyHQId` query param)
- `PATCH /[id]` - Update item
- `GET /[id]` - Get single item
- `DELETE /[id]` - Delete item

**Standard Response:**
```json
{
  "success": true,
  "[type]": { ... } // or "[type]s": [ ... ] for list
}
```

### AI Endpoint Routes

**Pattern:** `/api/workme/[type]/[action]-ai/route.ts`

**Example:** `/api/workme/presentations/outline-ai`

**Standard Input:**
```json
{
  "idea": "string",
  "count": number
}
```

**Standard Output:**
```json
{
  "success": true,
  "title": "string",
  "description": "string",
  "outline": [ ... ] // or appropriate structure
}
```

## localStorage Pattern

**Key Format:** `[type]_${companyHQId}`

**Example:** `presentations_cmhmdw78k0001mb1vioxdw2g8`

**Operations:**
- **Save:** Always save after API create/update
- **Load:** Load on home page mount (instant hydration)
- **Sync:** Update after API fetch
- **Delete:** Remove from array on delete

## Common Pitfalls to Avoid

1. ❌ **Don't show raw JSON** - Always parse and display in user-friendly UI
2. ❌ **Don't forget title/description** - AI should always return these
3. ❌ **Don't skip localStorage** - Always save for instant hydration
4. ❌ **Don't redirect to builder** - Always redirect to home after save
5. ❌ **Don't use artifactId** - Use `[type]Id` consistently
6. ❌ **Don't mix CleDeck/Presentation** - Use one model consistently

## Testing Checklist

- [ ] AI generates title and description
- [ ] User can edit generated content before saving
- [ ] Save goes to database + localStorage
- [ ] Home page hydrates from localStorage
- [ ] Sync button refreshes from database
- [ ] Builder loads all fields correctly
- [ ] Builder saves and redirects to home
- [ ] Delete removes from database + localStorage
- [ ] No raw JSON visible to user
- [ ] All routes use consistent naming

## Future Content Types

When adding new content types (Blog, Email, etc.), follow this exact pattern:

1. Create `/api/content/[type]` routes
2. Create `/api/workme/[type]/[action]-ai` endpoint
3. Create `/content/[type]/ai` page
4. Create `/content/[type]` home page
5. Create `/builder/[type]/[id]` builder page
6. Follow localStorage pattern
7. Test all flows

