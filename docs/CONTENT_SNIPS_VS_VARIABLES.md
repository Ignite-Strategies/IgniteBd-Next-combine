# Content Snips vs Variables — How It Works

**Goal:** Clear model for how templates use two different kinds of placeholders: **content snips** (stored text that can contain variables) and **pure variables** (single values from a DB entry). The template accepts either.

---

## The confusion

- **Content snips** hold actual **content** (paragraphs, openings, CTAs). That content can *contain* variable placeholders (e.g. “Hi {{firstName}}, …” or “at {{companyName}}”). So snips look like “content with variables in it” — but the **snip itself** is not a variable.
- **Variables** are the simple slots that resolve to **one value** from a known source: “company”, “firstName”, “title”. They don’t hold paragraphs; they’re the **field** that gets filled from a DB row (contact, owner, etc.).

So:

| Concept | What it is | Resolves to | Backed by |
|--------|------------|-------------|-----------|
| **Variable** | A single-value slot (e.g. company, firstName) | One string from a DB field or computed value | Contact/owner/computed — “a DB entry of sorts” |
| **Content snip** | A stored text block (can be long) | The snip’s text, with any variables inside it resolved afterward | `content_snips` row (snipName → snipText) |

Snips are **not** variables. Snips are **content** that may **use** variables inside them.

---

## How the template accepts either

A template (subject/body) can use two kinds of placeholders:

1. **Pure variable** — `{{firstName}}`, `{{companyName}}`, `{{title}}`, etc.  
   - Resolves directly to a value from the **variable source** (contact field, owner field, or computed).  
   - That source is “a DB entry of sorts” (e.g. one Contact row, one Owner).

2. **Content snip** — `{{snippet:snipName}}` (e.g. `{{snippet:intent_reach_out}}`).  
   - Resolves to the **snip’s text** from `content_snips` (by company + snipName).  
   - That text can contain its own `{{variableName}}` placeholders, which are then resolved in a second pass.

So the template doesn’t care whether a given placeholder is “variable” or “snippet”. It just has two syntaxes:

- `{{variableName}}` → lookup in variable catalogue → one value from DB/computed.
- `{{snippet:snipName}}` → lookup in `content_snips` → block of text, then resolve any `{{variableName}}` inside it.

So: **template accepts either content snips or pure variables**; each kind has its own resolution path and its own “db entry of sorts” (contact/owner for variables, content_snips row for snips).

---

## “DB entry of sorts” — mapping to data

- **Pure variables**  
  - Map to a **single field** on a known entity: Contact (firstName, companyName, title, …), Owner, or a computed value.  
  - That’s the “DB entry”: e.g. one row in `contacts`, and the variable is one column (or derived from it).

- **Content snips**  
  - Map to a **row** in `content_snips`: `companyHQId` + `snipName` → `snipText`.  
  - The “entry” is the snip row; the value we use is `snipText` (which may itself contain variables).

So both are “backed by a DB entry” in a loose sense:

- Variable → one field from contact/owner (or computed from it).
- Snippet → one content block from `content_snips`.

The template just needs a resolver that:

1. Expands `{{snippet:snipName}}` from `content_snips`.
2. Then resolves every `{{variableName}}` (from the catalogue) in the resulting string, using the contact/owner/computed “DB entry”.

---

## Two steps: snips first, then variables (per contact)

**Step 1 — Content snips (raw text):**  
Replace every `{{snippet:snipName}}` with the **raw text** from `content_snips`. That text is the same for everyone; it’s the “what to say” (the block of content). No contact yet — just expand the snip.

**Step 2 — Variables (on preview/send):**  
In the resulting string (template + expanded snips), replace every `{{variableName}}` with the value **for this contact**. Variables **own the look per contact**: same snip, different `{{firstName}}` / `{{companyName}}` per recipient.

So:

- **Snips** = store the text that needs to go there (content).
- **Variables** = own the look per contact (fill from that contact’s DB entry when we preview or send).

No FK is required for this. We don’t need a link from `content_snips` to a variable table to resolve — we just do two passes. An FK (e.g. “this snip uses these variables”) could still be useful later for dependency tracking or validation, but it’s optional.

---

## Making it work end-to-end

1. **Template authoring**  
   - Author can insert:
     - **Variables:** e.g. `{{companyName}}`, `{{firstName}}`.  
     - **Content snips:** e.g. `{{snippet:intent_reach_out}}`, `{{snippet:cta_book_call}}`.  
   - So the template “accepts either” in the same body/subject.

2. **Resolution order**  
   - **Pass 1 (snippets):** Replace every `{{snippet:snipName}}` with `content_snips.snipText` (for the company).  
   - **Pass 2 (variables):** In the resulting string, replace every `{{variableName}}` with the value from the variable catalogue (contact/owner/computed).  
   - No need for the template to “know” whether a placeholder is variable or snip; the resolver branches on syntax.

3. **Data model**  
   - **Variables:** Today = in-code catalogue (no Variable table). Each key maps to a source (CONTACT, OWNER, COMPUTED) and a field/compute rule. Optionally later: a `template_variables` (or similar) table with e.g. `variableKey`, `source`, `dbField` (or FK to contact field concept) so “variables that match a db entry” are explicit in the DB.  
   - **Content snips:** Already a DB model (`content_snips`). No FK to a “variable” table needed; the link is “snip text can contain variable placeholders”.

4. **Unified “slot” idea (optional)**  
   - If you want one abstraction: “template slot = either a variable or a content snip.”  
   - Then a slot could be stored as:  
     - `type: 'variable'`, `key: 'companyName'` → resolve from contact/owner.  
     - `type: 'snippet'`, `snipName: 'intent_reach_out'` → resolve from `content_snips`, then variables inside.  
   - Template body would still be a string with `{{variableName}}` and `{{snippet:snipName}}`; the “slot” view is just a structured way to list what the template uses, not required for resolution.

---

## Short summary

- **Content snips** = store the **text** that needs to go there (the content block). Same raw text for everyone until variables run.
- **Variables** = **own the look per contact**: when we preview or send, they fill from that contact’s data (firstName, companyName, etc.).
- **Two steps:** (1) Render content snips first → raw text. (2) Variables load on preview/send → per-contact.
- **Template** accepts both; no FK required for resolution — two passes are enough. Optional FK later if we want “this snip uses these variables” for dependency tracking.
