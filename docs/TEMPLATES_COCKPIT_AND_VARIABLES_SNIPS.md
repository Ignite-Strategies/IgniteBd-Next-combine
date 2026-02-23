# Templates Cockpit & Variables / Content Snips (Big Initiative)

**Status:** Initiative doc — Templates cockpit needs to become its own cockpit with Variables and Content Snips as first-class citizens. The “unlock” is content snips filling variables inside templates.

---

## 1. Where are the previous templates?

- **UI:** Email Templates page → **“View/Edit Templates”** → **View Templates** button.
- **Route:** `/templates/library-email?companyHQId=...` (Email Template Library).
- **API:** Templates are loaded from saved templates API (e.g. `/api/template/saved?companyHQId=...`). Library lists them; user can edit/delete.
- So previous templates **do** exist and are reachable via View Templates; they are just not surfaced alongside Variables or Content Snips in one place.

---

## 2. Is it just “build from manual or AI”?

- **Current create flow:** **Create New** → `/templates/create` → then **Manual**, **AI**, or **Clone**.
- So today, net new templates are built only via:
  - Manual (write subject/body),
  - AI (generate),
  - Clone (copy existing).
- There is **no** dedicated flow in this cockpit for:
  - Defining or managing **variables**, or
  - Choosing / assigning **content snips** that fill into templates (and that can contain variables).

---

## 3. No “set variables” in the cockpit

- **Current state:** There is **no** “set variables” UI on the Email Templates page (or in the template create/edit flows shown from that cockpit).
- **Where variables live today:**
  - Variables are **not** a database model. There is **no** `Variable` table in Prisma.
  - They are a **hardcoded catalogue** in `lib/services/variableMapperService.js`:
    - **VariableCatalogue:** `firstName`, `lastName`, `fullName`, `goesBy`, `companyName`, `title`, `email` (CONTACT), plus `timeSinceConnected` (COMPUTED).
  - Resolution: given a template body with `{{firstName}}` etc., the service looks up the contact (by contactId or email) and replaces those placeholders. So “variables” are effectively **contact/owner fields + computed fields**, not user-defined entities in the DB.

---

## 4. No “set content snips” in the cockpit — and that’s the unlock

- **Current state:** The **Email Templates** cockpit (the page in the screenshot) has **no** link or section for “Content Snips” or “Snippets.” So from the template cockpit you cannot:
  - See which snips exist,
  - Assign snips to a template,
  - Or insert `{{snippet:snipName}}` with a clear “snip library” right there.
- **Where content snips live today:**
  - **Model:** `content_snips` (company-scoped): `snipName`, `snipText`, `snipType`, `contextType`, `intentType`, `isActive`.
  - **UI:** Snippet **home** is under **Outreach** → **Snippets** (`/outreach/snippets`): list, filters, CSV upload, add/edit, “Add to template” (sends you to campaign create/edit).
  - **Templates cockpit** does not link to this; it doesn’t show or manage content snips at all.
- **The unlock:** Content snips are the reusable blocks (e.g. intent openings, CTAs) that **fill into** templates. Those snips can themselves contain variables (e.g. `{{firstName}}`, `{firm_name}`). So the full flow should be:
  1. Template body (or subject) contains `{{snippet:snipName}}` and/or `{{variableName}}`.
  2. At send/preview time: resolve **snippets first** (replace `{{snippet:snipName}}` with `snipText` from `content_snips`), then resolve **variables** inside the resulting text (contact/owner fields, etc.).
- **Gap:** The variable mapper (`variableMapperService`) currently resolves only `{{variableName}}` (from the catalogue). It does **not** resolve `{{snippet:snipName}}` from `content_snips`. So snippet resolution is not yet wired in the stack (see below).

---

## 5. Do we have a Variable model with FK to content_snips so they align?

- **Short answer: No.**
  - There is **no** `Variable` (or `template_variables`) model in the schema.
  - **Variables** = in-code catalogue in `variableMapperService.js` (contact/owner/computed keys).
  - **content_snips** = DB table, company-scoped; no FK from any “variable” table to `content_snips`.
- So variables and content_snips **do not** align via a shared model or FK. They align only by **convention**:
  - Snip **text** can contain the same placeholder names (e.g. `{{firstName}}`) that the variable mapper knows how to resolve.
  - There is no DB entity that says “this variable is backed by this content snip” or “this snip fills this variable slot.”
- **If we wanted alignment in the schema**, options could be:
  - **Option A:** Introduce a **Variable** (or **template_variable**) model, company-scoped, with e.g. `variableKey`, `label`, `source` (contact | owner | snippet | custom), and optional `contentSnipId` FK to `content_snips` when `source === 'snippet'`. Then the mapper could resolve variables by looking up the Variable row and, when it points to a snip, use that snip’s text (then hydrate variables inside it).
  - **Option B:** Keep variables as the in-code catalogue for “contact/owner/computed” and treat **snippet** as a separate resolution step: first expand `{{snippet:snipName}}` from `content_snips`, then run the existing variable mapper on the result. No new Variable model; alignment is “snip body uses same variable names as the catalogue.”

---

## 6. Variable mapper in the stack

- **Where:** `lib/services/variableMapperService.js`.
- **What it does:**
  - **VariableCatalogue:** fixed set of keys (firstName, lastName, companyName, title, email, fullName, goesBy, timeSinceConnected).
  - **resolveVariableFromDatabase(variableName, context):** resolves one variable (CONTACT or COMPUTED) from DB (contact lookup by contactId or contactEmail/to).
  - **extractVariableNames(template):** finds `{{variableName}}` via regex `/\{\{(\w+)\}\}/g` — so only **single-token** placeholders (no `snippet:snipName` in that regex).
  - **hydrateTemplateFromDatabase(templateBody, context, metadata):** replaces all extracted `{{variableName}}` with resolved values. **Does not** handle `{{snippet:snipName}}`.
- **Used by:** e.g. `POST /api/template/hydrate-with-contact`, `POST /api/variables/hydrate`, `app/api/outreach/build-payload/route.js` (hydrateTemplateFromDatabase).
- **Gap:** To “fill variables with content snips” we need either:
  - A **pre-pass** that replaces `{{snippet:snipName}}` with the corresponding `content_snips.snipText` (by companyHQId + snipName), then runs the existing variable hydration on the result, or
  - Extend the mapper to treat `snippet:*` as a special variable source that pulls from `content_snips` and then recursively hydrates variables inside that text.

---

## 7. What “its own cockpit” should include (goals)

1. **Previous templates** — Keep and make obvious: View/Edit Templates (library) as a primary action from this cockpit.
2. **Create paths** — Keep Manual / AI / Clone, but add:
   - **Set variables** (even if only “view which variables are available” and “see which are used in this template” to start; later, optional Variable model + FK to content_snips).
   - **Set content snips** — Link to Snippet home and/or in-context “insert snippet” when editing a template; show which snips exist and allow inserting `{{snippet:snipName}}`.
3. **Single place** — One Templates cockpit that surfaces:
   - View/Edit Templates,
   - Create New (Manual / AI / Clone),
   - Variables (catalogue today; later possibly DB-backed and aligned with snips),
   - Content Snips (link + insert; resolution of `{{snippet:...}}` in variable mapper).
4. **Resolution order** — Document and implement: snippets first (expand `{{snippet:snipName}}` from `content_snips`), then variables (contact/owner/computed) inside the expanded body.

---

## 8. Summary table

| Topic | Current state |
|-------|----------------|
| Previous templates | Under View Templates → `/templates/library-email` |
| Create flow | Manual, AI, Clone only |
| Set variables | No UI; variables = in-code catalogue in variableMapperService |
| Set content snips | No UI in Templates cockpit; snips live under Outreach → Snippets |
| Variable model with FK to content_snips | No — no Variable model; no FK |
| Variable mapper | Yes — `variableMapperService.js`; resolves `{{var}}` only, not `{{snippet:snipName}}` |

This doc should be the single reference for the “Templates cockpit + variables + content snips” initiative and the decision on whether to introduce a Variable model and how to wire snippet resolution into the variable mapper.
