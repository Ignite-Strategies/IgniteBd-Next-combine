# OpenAI Integration Pattern

**Standard flow for AI generation features - don't reinvent the wheel!**

This document outlines the proven pattern for integrating OpenAI generation into the app. Follow this pattern for consistency and reliability.

## The Pattern

```
User Input → API Call (with loading) → Store in localStorage → Navigate → Display → Save
```

## Step-by-Step Flow

### 1. **User Input Page** (e.g., `build-from-contacts/page.jsx`)

**Responsibilities:**
- Collect user input/selection
- Show loading overlay while API call is in progress
- Call API and **WAIT** for response
- Store generated data in localStorage (temporary state)
- Navigate to display/edit page

**Key Points:**
- ✅ **DO NOT navigate immediately** - wait for API response
- ✅ Use loading overlay to prevent interaction during generation
- ✅ Store generated data in localStorage as JSON
- ✅ Only navigate after successful API response

**Example:**
```jsx
const handleContactSelect = async (contactId) => {
  if (!companyHQId) {
    setError('Company context is required');
    return;
  }

  const ownerId = typeof window !== 'undefined' ? localStorage.getItem('ownerId') : null;
  if (!ownerId) {
    setError('Owner ID not found. Please sign in again.');
    return;
  }

  try {
    setGeneratingContactId(contactId); // Show loading overlay
    setError(null);

    // Call API - WAIT for response
    const response = await api.post('/api/personas/generate-minimal', {
      companyHQId,
      contactId,
      ownerId,
    });

    if (response.data?.success && response.data?.persona) {
      const persona = response.data.persona;
      
      // Store in localStorage (temporary state)
      const tempData = {
        personName: persona.personName || '',
        title: persona.title || '',
        company: persona.company || '',
        coreGoal: persona.coreGoal || '',
      };
      localStorage.setItem('tempPersonaData', JSON.stringify(tempData));
      
      // Navigate AFTER successful generation
      router.push(`/personas/from-contact?contactId=${contactId}&companyHQId=${companyHQId}`);
    } else {
      setError(response.data?.error || 'Failed to generate persona');
      setGeneratingContactId(null);
    }
  } catch (err) {
    console.error('Failed to generate:', err);
    setError(err.response?.data?.error || err.message || 'Failed to generate');
    setGeneratingContactId(null);
  }
};
```

**Loading Overlay:**
```jsx
{generatingContactId && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-xl">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
      <p className="mt-4 text-lg font-semibold text-gray-900">Generating...</p>
      <p className="mt-2 text-sm text-gray-600">This may take a moment</p>
    </div>
  </div>
)}
```

### 2. **API Route** (e.g., `/api/personas/generate-minimal/route.ts`)

**Responsibilities:**
- Authenticate (Firebase token verification)
- Validate input parameters
- Call service layer to prepare data
- Build prompts
- Call OpenAI API
- Parse and validate response
- Return structured JSON

**Key Points:**
- ✅ Always verify Firebase token first
- ✅ Get owner from token, validate membership
- ✅ Use service layer for data prep and prompt building
- ✅ Use strict JSON parsing (no markdown extraction)
- ✅ Return consistent response format: `{ success: true, data: {...} }`

**Example Structure:**
```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', details: error.message },
      { status: 401 }
    );
  }

  // 2. Get owner and validate
  const { prisma } = await import('@/lib/prisma');
  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
  });
  if (!owner) {
    return NextResponse.json(
      { success: false, error: 'Owner not found' },
      { status: 404 }
    );
  }

  // 3. Validate input
  const body = await request.json();
  const { contactId, companyHQId, ownerId } = body;
  if (!contactId || !companyHQId) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  // 4. Validate membership
  const { resolveMembership } = await import('@/lib/membership');
  const { membership } = await resolveMembership(owner.id, companyHQId);
  if (!membership) {
    return NextResponse.json(
      { success: false, error: 'Access denied to this company' },
      { status: 403 }
    );
  }

  try {
    // 5. Prepare data (service layer)
    const prepResult = await DataPrepService.prepare({ contactId, companyHQId });
    if (!prepResult.success) {
      return NextResponse.json(
        { success: false, error: prepResult.error },
        { status: 400 }
      );
    }

    // 6. Build prompts (service layer)
    const { systemPrompt, userPrompt } = PromptService.buildPrompts(prepResult.data);

    // 7. Call OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'No response from OpenAI' },
        { status: 500 }
      );
    }

    // 8. Parse response (service layer)
    const parsed = ParsingService.parse(content);

    // 9. Return success
    return NextResponse.json({
      success: true,
      data: parsed, // or persona, template, etc.
    });
  } catch (error: any) {
    console.error('Generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
```

### 3. **Service Layer** (3 services)

#### **DataPrepService** (e.g., `PersonaPromptPrepService.ts`)
- Fetches required data from database
- Uses dynamic Prisma import: `const { prisma } = await import('@/lib/prisma');`
- Returns structured data for prompt building

#### **PromptService** (e.g., `PersonaMinimalPromptService.ts`)
- Builds system and user prompts
- Follows "fix correctness at the prompt" principle
- Includes strict JSON schema in prompt
- Includes examples and requirements

#### **ParsingService** (e.g., `PersonaParsingService.ts`)
- Strict JSON parsing (no markdown extraction)
- Field-by-field validation
- Throws errors if format is wrong (indicates prompt bug)
- Returns typed, validated data

### 4. **Display/Edit Page** (e.g., `from-contact/page.jsx`)

**Responsibilities:**
- Read temporary data from localStorage on mount
- Populate form fields with generated data
- Allow user to edit
- Save to database

**Key Points:**
- ✅ Read from localStorage in `useEffect` on mount
- ✅ Clean up localStorage after reading
- ✅ Form fields are always visible (no conditional rendering)
- ✅ Individual `useState` hooks for each field (matches template pattern)

**Example:**
```jsx
function FromContactContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams?.get('contactId');
  const companyHQId = searchParams?.get('companyHQId') || '';

  // Individual field state
  const [personName, setPersonName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [coreGoal, setCoreGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load generated data from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const tempData = localStorage.getItem('tempPersonaData');
    if (tempData) {
      try {
        const data = JSON.parse(tempData);
        setPersonName(data.personName || '');
        setTitle(data.title || '');
        setCompany(data.company || '');
        setCoreGoal(data.coreGoal || '');
        
        // Clean up after using
        localStorage.removeItem('tempPersonaData');
      } catch (err) {
        console.error('Failed to parse temp data:', err);
      }
    }
  }, []);

  // Save handler
  const handleSave = async () => {
    // Validation...
    setSaving(true);
    try {
      const response = await api.post('/api/personas/save', {
        persona: {
          personName: personName.trim(),
          title: title.trim(),
          // ... other fields
        },
        companyHQId,
      });
      
      if (response.data?.success) {
        router.push(`/personas?companyHQId=${companyHQId}&saved=true`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Render form (always visible)
  return (
    <div>
      {/* Form fields */}
    </div>
  );
}
```

## Key Principles

### 1. **Wait for API Response**
❌ **DON'T:**
```jsx
handleClick() {
  api.post('/api/generate');
  router.push('/next-page'); // TOO FAST!
}
```

✅ **DO:**
```jsx
async handleClick() {
  setLoading(true);
  const response = await api.post('/api/generate');
  if (response.data?.success) {
    localStorage.setItem('tempData', JSON.stringify(response.data.data));
    router.push('/next-page');
  }
  setLoading(false);
}
```

### 2. **Use localStorage for Temporary State**
- Store generated data in localStorage with a descriptive key
- Read it on the next page
- Clean it up after using it
- Don't put large data in URL query params

### 3. **Service Layer Architecture**
- **DataPrepService**: Fetches data from DB
- **PromptService**: Builds prompts (fix correctness here!)
- **ParsingService**: Parses and validates response

### 4. **Form Fields Always Visible**
- Don't hide form behind loading state
- Populate fields when data arrives
- User can edit at any time
- Matches template builder pattern

### 5. **Consistent Error Handling**
- Show errors to user
- Don't block form if generation fails
- User can still fill manually

## Checklist for New OpenAI Features

- [ ] User input page shows loading overlay during API call
- [ ] API call completes before navigation
- [ ] Generated data stored in localStorage (not query params)
- [ ] API route authenticates and validates membership
- [ ] Service layer: DataPrep → Prompt → Parsing
- [ ] Prompts include strict JSON schema
- [ ] Parsing is strict (throws on invalid JSON)
- [ ] Display page reads from localStorage on mount
- [ ] localStorage cleaned up after reading
- [ ] Form fields always visible
- [ ] Individual useState hooks for each field
- [ ] Save handler validates and calls API

## Examples in Codebase

- **Persona Generation**: `app/(authenticated)/personas/build-from-contacts/page.jsx` → `from-contact/page.jsx`
- **Template Generation**: `app/(authenticated)/builder/template/[templateId]/page.jsx`
- **API Route**: `app/api/personas/generate-minimal/route.ts`
- **Services**: `lib/services/PersonaPromptPrepService.ts`, `PersonaMinimalPromptService.ts`, `PersonaParsingService.ts`

## Common Mistakes to Avoid

1. ❌ Navigating before API call completes
2. ❌ Putting generated data in URL query params
3. ❌ Hiding form behind loading state
4. ❌ Not cleaning up localStorage
5. ❌ Using static Prisma import in services
6. ❌ Not validating membership
7. ❌ Not handling errors gracefully
8. ❌ Not using service layer (putting everything in route)

## Questions?

If you're building a new OpenAI feature and unsure about the pattern, check:
1. How personas do it (`build-from-contacts` → `from-contact`)
2. How templates do it (`builder/template/[templateId]`)
3. This document

**Don't reinvent the wheel - follow the pattern!**

