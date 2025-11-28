# Documentation Standard Operating Procedure (SOP)

## 📋 Where to Put New Documentation

**ALL documentation must go in folders. NO loose .md files in root or docs/ root.**

### Folder Structure

```
docs/
├── architecture/          # System architecture, patterns, design decisions
├── client-operations/     # Client operations (proposals, work packages, execution, products, deliverables)
│   ├── proposals/
│   ├── products-deliverables/
│   ├── work-packages/
│   └── EXECUTION.md
├── authentication/        # Auth-related docs (if separate from client-operations)
├── contacts/              # Contact model and management
├── bd-intelligence/       # BD Intelligence scoring and AI features
├── content/               # Content hub, blog, social posts
├── personas-parser/       # Persona building and data parsing
├── templates/             # Template system
├── csv-import/            # CSV upload and mapping
├── integrations/          # Third-party integrations (Microsoft, SendGrid, etc.)
├── setup/                 # Setup guides, environment variables, migrations
├── ux/                    # UX maps, navigation, user experience
├── issue-management/      # Known issues, problems, refactoring needs
├── refactoring/           # Refactoring plans and documentation
└── architecture/          # Core architecture docs
```

## 🎯 Decision Tree: Where Does My Doc Go?

### Is it about...
- **Client operations** (proposals, work packages, execution, deliverables)?
  → `docs/client-operations/` (or subfolder: `proposals/`, `work-packages/`, `products-deliverables/`)
  
- **Authentication or login flows**?
  → `docs/authentication/` (or `docs/client-operations/` if client portal related)
  
- **Contacts or contact model**?
  → `docs/contacts/`
  
- **BD Intelligence or AI scoring**?
  → `docs/bd-intelligence/`
  
- **Content hub, blog posts, social content**?
  → `docs/content/`
  
- **Personas or data parsing**?
  → `docs/personas-parser/`
  
- **Templates**?
  → `docs/templates/`
  
- **CSV import/export**?
  → `docs/csv-import/`
  
- **Third-party integrations** (Microsoft, SendGrid, Lusha, etc.)?
  → `docs/integrations/`
  
- **Setup, environment variables, migrations**?
  → `docs/setup/`
  
- **UX maps, navigation, user experience**?
  → `docs/ux/`
  
- **Known issues or problems**?
  → `docs/issue-management/`
  
- **Refactoring plans**?
  → `docs/refactoring/`
  
- **System architecture, patterns, design**?
  → `docs/architecture/`

## ✅ Rules

1. **NO loose .md files in root** - Everything goes in `docs/`
2. **NO loose .md files in docs/ root** - Everything goes in a folder
3. **Create a folder if needed** - If a topic doesn't have a folder, create one
4. **Update README.md** - Add your new doc to the appropriate section in `docs/README.md`
5. **Use descriptive names** - File names should be clear (e.g., `EXECUTION.md` not `exec.md`)

## 📝 Naming Conventions

- **Feature docs**: `FEATURE_NAME.md` (e.g., `EXECUTION.md`, `BD_INTELLIGENCE.md`)
- **Architecture docs**: `ARCHITECTURE_TOPIC.md` (e.g., `HYDRATION.md`, `HOOKS.md`)
- **Issue docs**: `ISSUE_NAME.md` (e.g., `BD_ROADMAP.md`)
- **Refactoring docs**: `REFACTOR_NAME.md` (e.g., `BDOS_V2_REFACTOR.md`)

## 🚫 What NOT to Do

- ❌ Don't put docs in the root directory
- ❌ Don't put docs directly in `docs/` without a folder
- ❌ Don't create duplicate folders (check if one exists first)
- ❌ Don't use vague names like `notes.md` or `stuff.md`
- ❌ Don't forget to update `docs/README.md`

## 📋 Checklist Before Committing

- [ ] Doc is in the correct folder
- [ ] Folder exists (created if needed)
- [ ] Doc name is descriptive
- [ ] Updated `docs/README.md` with link to new doc
- [ ] No loose .md files in root or docs/ root

## 🔍 Quick Reference

| Topic | Folder |
|-------|--------|
| Client operations | `docs/client-operations/` |
| Proposals | `docs/client-operations/proposals/` |
| Work packages | `docs/client-operations/work-packages/` |
| Products/Deliverables | `docs/client-operations/products-deliverables/` |
| Execution | `docs/client-operations/EXECUTION.md` |
| Authentication | `docs/authentication/` |
| Contacts | `docs/contacts/` |
| BD Intelligence | `docs/bd-intelligence/` |
| Content | `docs/content/` |
| Personas | `docs/personas-parser/` |
| Templates | `docs/templates/` |
| CSV Import | `docs/csv-import/` |
| Integrations | `docs/integrations/` |
| Setup | `docs/setup/` |
| UX | `docs/ux/` |
| Issues | `docs/issue-management/` |
| Refactoring | `docs/refactoring/` |
| Architecture | `docs/architecture/` |

---

**Last Updated**: November 2025  
**Status**: Active SOP - Follow this for all new documentation


