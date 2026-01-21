# Compose Page Refactor Proposal

## Current State (The Problem)

**File:** `app/(authenticated)/outreach/compose/page.jsx`
- **Lines:** 1,341
- **State Hooks:** ~20 useState calls
- **Effect Hooks:** ~10 useEffect calls
- **Responsibilities:** Everything (god component)

### Current Responsibilities (Too Many!)
1. URL param handling (companyHQId)
2. localStorage reading (ownerId, companyHQId)
3. Form state (to, subject, body, contact, template)
4. Template loading & selection
5. Contact selection
6. Sender verification (via callback from SenderIdentityPanel)
7. Preview functionality (inline + modal)
8. Email sending (build payload + send)
9. Quick contact creation modal
10. Variable hydration
11. Template variable extraction
12. Success/error handling
13. UI rendering (form, preview, modals)

## Proposed Refactor: Component Breakdown

### 1. **ComposePage** (Main Container - ~100 lines)
**Responsibilities:**
- URL param handling
- localStorage reading (ownerId, companyHQId)
- Route-level error handling (missing companyHQId)
- Orchestrates child components

**State:**
- `companyHQId` (from URL/localStorage)
- `ownerId` (from localStorage)

**Components:**
- `<ComposeForm />` (main form)
- `<TemplateSelector />` (sidebar)

---

### 2. **ComposeForm** (~300 lines)
**Responsibilities:**
- Form state management
- Contact selection
- Email composition
- Form validation
- Submit handling

**State:**
- `to`, `toName`, `subject`, `body`
- `selectedContact`, `contactId`
- `selectedTemplateId`
- `error`, `sending`, `success`

**Components:**
- `<SenderField />` (wraps SenderIdentityPanel)
- `<ContactField />` (wraps ContactSelector + Quick Save)
- `<EmailFields />` (to, subject, body)
- `<VariableHelper />` (variable insertion UI)
- `<ComposeActions />` (preview + send buttons)

**Props:**
- `companyHQId`
- `ownerId`
- `selectedTemplate` (from parent)
- `onTemplateSelect` (callback)

---

### 3. **TemplateSelector** (~150 lines)
**Responsibilities:**
- Load templates for company
- Display template list
- Handle template selection
- Show loading/empty states

**State:**
- `templates`
- `loadingTemplates`
- `selectedTemplateId`

**Props:**
- `companyHQId`
- `onSelect` (callback to parent)
- `selectedTemplateId` (controlled)

---

### 4. **EmailFields** (~100 lines)
**Responsibilities:**
- To, Subject, Body input fields
- Template indicator (if template selected)
- Variable insertion helpers

**State:**
- None (fully controlled)

**Props:**
- `to`, `toName`, `subject`, `body`
- `onChange` handlers
- `selectedTemplate` (for indicator)
- `templateVariables` (for insertion)

---

### 5. **VariableHelper** (~150 lines)
**Responsibilities:**
- Display available variables
- Handle variable insertion
- Show template-specific variables
- Show warnings for unresolved variables

**State:**
- None (fully controlled)

**Props:**
- `templateVariables` (if template selected)
- `body` (for cursor position)
- `onInsert` (callback)
- `contactId` (for warnings)

---

### 6. **ComposeActions** (~100 lines)
**Responsibilities:**
- Preview button
- Send button
- Loading states
- Disabled states (validation)

**State:**
- None (fully controlled)

**Props:**
- `onPreview`
- `onSend`
- `loading`
- `disabled` (validation state)
- `hasVerifiedSender`

---

### 7. **EmailPreview** (~200 lines)
**Responsibilities:**
- Preview modal/section
- Hydrated content display
- Edit preview (split screen)
- Send from preview

**State:**
- `previewData`
- `previewError`
- `showModal`

**Props:**
- `previewData`
- `onClose`
- `onSend` (from preview)
- `onEdit` (update form from preview)

---

### 8. **QuickContactModal** (~100 lines)
**Responsibilities:**
- Quick contact creation form
- Validation
- API call
- Success handling

**State:**
- `formData` (firstName, lastName, email)
- `loading`
- `error`

**Props:**
- `companyHQId`
- `onSave` (callback with new contact)
- `onClose`

---

### 9. **ComposePageProvider** (Context - Optional)
**Responsibilities:**
- Share compose state across components
- Reduce prop drilling

**State:**
- Form state
- Template state
- Preview state

**Components:**
- All compose components

---

## Refactoring Steps

### Phase 1: Extract Preview (Low Risk)
1. Create `EmailPreview` component
2. Move preview logic from compose page
3. Test preview functionality

### Phase 2: Extract Template Selector (Low Risk)
1. Create `TemplateSelector` component
2. Move template loading/selection logic
3. Test template selection

### Phase 3: Extract Form Fields (Medium Risk)
1. Create `EmailFields` component
2. Create `VariableHelper` component
3. Move form field logic
4. Test form editing

### Phase 4: Extract Actions (Low Risk)
1. Create `ComposeActions` component
2. Move button logic
3. Test send/preview

### Phase 5: Extract Quick Contact (Low Risk)
1. Create `QuickContactModal` component
2. Move modal logic
3. Test contact creation

### Phase 6: Split Main Form (High Risk)
1. Create `ComposeForm` component
2. Move all form logic
3. Keep compose page as orchestrator
4. Test full flow

---

## Benefits

1. **Maintainability:** Each component has single responsibility
2. **Testability:** Components can be tested in isolation
3. **Reusability:** Components can be reused elsewhere
4. **Debugging:** Easier to find issues in smaller files
5. **Performance:** Can optimize individual components
6. **Team Collaboration:** Multiple devs can work on different components

---

## File Structure

```
app/(authenticated)/outreach/compose/
  ├── page.jsx (orchestrator, ~100 lines)
  └── components/
      ├── ComposeForm.jsx (~300 lines)
      ├── TemplateSelector.jsx (~150 lines)
      ├── EmailFields.jsx (~100 lines)
      ├── VariableHelper.jsx (~150 lines)
      ├── ComposeActions.jsx (~100 lines)
      ├── EmailPreview.jsx (~200 lines)
      └── QuickContactModal.jsx (~100 lines)
```

**Total:** ~1,100 lines (vs 1,341) but much more maintainable

---

## Migration Strategy

1. **Start with low-risk extractions** (Preview, TemplateSelector)
2. **Keep existing page working** during refactor
3. **Test each extraction** before moving to next
4. **Gradually replace** old code with new components
5. **Remove old code** only after all tests pass

---

## Questions to Consider

1. **Context vs Props:** Use Context API to avoid prop drilling?
2. **State Management:** Keep useState or move to useReducer?
3. **Custom Hooks:** Extract logic into hooks (useComposeForm, useTemplates)?
4. **Error Boundaries:** Add error boundaries for each component?

