# Documentation Index

Welcome to the IgniteBD documentation. All documentation has been organized into logical folders by feature/theme.

## 📚 Documentation Structure

### Core Operations
- **[Client Operations](./client-operations/CLIENT_OPERATIONS.md)** - Complete client operations guide (onboarding, login, contact search, deliverables, execution)
- **[Authentication](./AUTHENTICATION.md)** - Complete authentication guide (Firebase Auth, activation, normalization)
- **[Migration](./MIGRATION.md)** - Database migrations and data cleanup procedures

### Client Operations (`/client-operations/`)

All client operations documentation including proposals, work packages, products, and deliverables:

- **[Main Guide](./client-operations/CLIENT_OPERATIONS.md)** - Complete client operations guide
- **[Proposals](./client-operations/proposals/)** - Proposal builder and structure
- **[Products & Deliverables](./client-operations/products-deliverables/)** - Products, deliverables, and work items
- **[Work Packages](./client-operations/work-packages/)** - Work package system, phases, and execution

#### 👤 Personas & Parser (`/personas-parser/`)
Persona building and data parsing:
- Persona build process
- Persona mapper review
- Enrichment to parser plan
- Universal parser architecture

#### 📇 Contacts (`/contacts/`)
Contact model and management:
- Contact model documentation

#### 📄 Templates (`/templates/`)
Template system:
- Template system documentation

#### 📊 CSV Import (`/csv-import/`)
CSV upload and mapping:
- CSV upload and mapper management

### Architecture (`/architecture/`)

Core architecture and system design documentation:

- **[Overview](./architecture/overview.md)** - Complete architecture guide for Next.js stack
- **[Hydration](./architecture/hydration.md)** - Hydration system: ownerId → companyHQId → Everything
- **[Contacts](./architecture/contacts.md)** - Contact management architecture
- **[Hooks](./architecture/hooks.md)** - Complete guide to all React hooks
- **[Use Client Directive](./architecture/use-client-directive.md)** - Next.js use client patterns
- **[Architecture Analysis](./architecture/ARCHITECTURE_ANALYSIS.md)** - System analysis
- **[Next.js Suspense Pattern](./architecture/NEXTJS_SUSPENSE_PATTERN.md)** - Suspense patterns
- **[Project Status](./architecture/ProjectStatusandUpdates.md)** - Project status and updates

### Setup (`/setup/`)

Setup and configuration guides:

- **[Environment Variables](./setup/environment-variables.md)** - Environment variables setup
- **[Migration Checklist](./setup/migration-checklist.md)** - Migration checklist from old repos to Next.js
- **[Prisma Vercel Workflow](./setup/prisma-vercel-workflow.md)** - Prisma and Vercel deployment
- **[Vercel Environment Variables](./setup/VERCEL_ENV_VARS.md)** - Vercel-specific env vars
- **[LocalStorage Keys](./setup/localStorageKeys.md)** - LocalStorage key reference

### Integrations (`/integrations/`)

Third-party integration guides:

- **[Microsoft](./integrations/microsoft.md)** - Complete Microsoft OAuth, Graph API, and Azure AD integration guide
- **[SendGrid](./integrations/sendgrid.md)** - SendGrid email integration guide
- **[Enrichment](./integrations/enrichment.md)** - Data enrichment integration
- **[Lusha Architecture](./integrations/lusha-architecture.md)** - Lusha integration architecture

### UX (`/ux/`)

User experience and navigation:

- **[UX Navigation](./ux/UX_NAV.md)** - Navigation and UX patterns

### Issue Management (`/issue-management/`)

Known issues, problems, and areas needing refactoring:

- **[BD Roadmap Issues](./issue-management/BD_ROADMAP.md)** - BD Roadmap refactoring requirements
- **[BD Roadmap Vision](./issue-management/BD_ROADMAP_VISION.md)** - BD Roadmap vision document

## 🚀 Quick Start

1. **New to the project?** Start with [Architecture Overview](./architecture/overview.md)
2. **Setting up locally?** Check [Environment Variables](./setup/environment-variables.md)
3. **Working with clients?** See [Client Operations](./CLIENT_OPERATIONS.md)
4. **Understanding authentication?** Read [Authentication](./AUTHENTICATION.md)
5. **Understanding hydration?** Read [Hydration Architecture](./architecture/hydration.md)

## 📖 Documentation by Topic

### Getting Started
- [Architecture Overview](./architecture/overview.md) - Start here for a complete understanding
- [Environment Variables](./setup/environment-variables.md) - Required environment variables

### Core Concepts
- [Hydration Architecture](./architecture/hydration.md) - How data flows through the system
- [Contact Management](./architecture/contacts.md) - Contact system architecture
- [React Hooks](./architecture/hooks.md) - All available hooks and usage patterns
- [Client Operations](./CLIENT_OPERATIONS.md) - Complete client operations guide
- [Authentication](./AUTHENTICATION.md) - Complete authentication guide

### Feature Areas
- [Work Packages](./work-packages/) - Work package system and phases
- [Proposals](./proposals/) - Proposal builder and structure
- [Products & Deliverables](./products-deliverables/) - Products and deliverables
- [Personas & Parser](./personas-parser/) - Persona building and parsing
- [Templates](./templates/) - Template system

### Integrations
- [Microsoft Integration](./integrations/microsoft.md) - Microsoft OAuth and Graph API
- [SendGrid Integration](./integrations/sendgrid.md) - Email sending via SendGrid
- [Enrichment](./integrations/enrichment.md) - Data enrichment

### Operations
- [Client Operations](./client-operations/CLIENT_OPERATIONS.md) - Complete client operations guide
- [Authentication](./AUTHENTICATION.md) - Complete authentication guide
- [Migration](./MIGRATION.md) - Database migrations and data cleanup procedures

### Issue Management
- [BD Roadmap Issues](./issue-management/BD_ROADMAP.md) - BD Roadmap refactoring requirements

## 🔍 Finding What You Need

**Looking for...**

- **How the app works?** → [Architecture Overview](./architecture/overview.md)
- **How data loads?** → [Hydration Architecture](./architecture/hydration.md)
- **How to use hooks?** → [Hooks Guide](./architecture/hooks.md)
- **How to set up Microsoft?** → [Microsoft Integration](./integrations/microsoft.md)
- **How to configure environment?** → [Environment Variables](./setup/environment-variables.md)
- **How contacts work?** → [Contact Management](./architecture/contacts.md)
- **How client operations work?** → [Client Operations](./client-operations/CLIENT_OPERATIONS.md)
- **How authentication works?** → [Authentication](./AUTHENTICATION.md)
- **How to run migrations?** → [Migration Guide](./MIGRATION.md)
- **Work packages?** → [Work Packages Folder](./client-operations/work-packages/)
- **Proposals?** → [Proposals Folder](./client-operations/proposals/)
- **Products/Deliverables?** → [Products & Deliverables Folder](./client-operations/products-deliverables/)
- **Personas?** → [Personas & Parser Folder](./personas-parser/)

## 📝 Contributing

When adding new documentation:

1. **Feature docs** → Place in appropriate feature folder (`/work-packages/`, `/proposals/`, etc.)
2. **Architecture docs** → Place in `/architecture/`
3. **Setup guides** → Place in `/setup/`
4. **Integration guides** → Place in `/integrations/`
5. **Issues** → Place in `/issue-management/`
6. **Update this README** → Add links to new docs

## 🔗 Related Resources

- **Main README** → See `/README.md` for project overview
- **Codebase** → See `/src/` for implementation details
- **Prisma Schema** → See `/prisma/schema.prisma` for database models

---

**Last Updated**: November 2025  
**Documentation Version**: 3.0.0 (Organized by Feature Folders)

## 📦 Recently Organized

All documentation has been organized into thematic folders:

- **Client Operations** → `/client-operations/` (main guide + 3 subfolders)
  - Work Packages (13 files)
  - Proposals (3 files)
  - Products & Deliverables (5 files)
- **Personas & Parser** → `/personas-parser/` (4 files)
- **Contacts** → `/contacts/` (1 file)
- **Templates** → `/templates/` (1 file)
- **CSV Import** → `/csv-import/` (1 file)
- **Setup** → `/setup/` (5 files)
- **UX** → `/ux/` (1 file)
- **Issue Management** → `/issue-management/` (3 files)
