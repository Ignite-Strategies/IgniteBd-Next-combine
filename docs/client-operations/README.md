# Client Operations

This folder contains all documentation related to client operations - the complete flow from onboarding clients to delivering work.

## Structure

### Main Guide
- **[CLIENT_OPERATIONS.md](./CLIENT_OPERATIONS.md)** - Complete guide covering:
  - Contact to client walkthrough
  - Client portal login flow
  - Contact search architecture
  - Owner-side operations
  - Data relationships
  - API endpoints

### Execution
- **[EXECUTION.md](./EXECUTION.md)** - Execution system documentation:
  - Company search and work package selection
  - Work package hydration and editing
  - Item status management
  - Deliverable creation
  - Current implementation details

### Subfolders

#### 📋 Proposals (`/proposals/`)
Proposal builder and structure:
- Proposal builder system
- Proposal model and structure
- Proposal templates

#### 🎯 Products & Deliverables (`/products-deliverables/`)
Products, deliverables, and work items:
- Product model and schema
- Deliverable system
- Product vs Deliverable
- Work item definitions

#### 📦 Work Packages (`/work-packages/`)
Work package system, phases, and execution:
- Work package structure, build, system
- Phase duration, scheduling, completion
- CSV import/export
- Date logic and investigations
- Execution and tracking

## Key Concepts

**The Core Reality:**
```
Contact → Contract → Deliverables → Client Portal → Pay Bills
```

**Key Principle:** Contact-First (Universal Personhood)
- Contact exists in IgniteBD (funnel, outreach, etc.)
- Same Contact can access Client Portal
- Contact's email = Firebase login username
- Contact's `firebaseUid` = Portal identity

## Workflow

1. **Onboarding** - Contact to client walkthrough
2. **Proposal** - Create and approve proposals
3. **Work Packages** - Build work packages with phases and items
4. **Execution** - Track progress and build deliverables
5. **Client Portal** - Clients view their work and proposals

---

**Last Updated**: November 2025

