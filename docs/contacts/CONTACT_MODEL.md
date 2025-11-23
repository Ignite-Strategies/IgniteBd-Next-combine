# Contact Model - Complete Reference

## Contact Overview

**Contact** is the central entity in the IgniteBD system that represents **all people** - prospects, clients, partners, or anyone you want to get to know. It's the universal container for human relationships in your business development ecosystem.

## Premise

**The Contact is all things** - it represents:
- **Prospects**: People you're trying to convert into clients
- **Clients**: People who have become customers
- **Partners**: Strategic relationships
- **Anyone you want to know**: Leads, referrals, industry contacts

**Key Principle**: A Contact is a **person**, not a company. Companies are separate entities (`Company` model) that Contacts can be associated with via `contactCompanyId`.

**Multi-Tenancy**: Contacts are scoped to `CompanyHQ` (via `crmId`) - each tenant has their own contact database.

**Flexibility**: Contacts can be:
- **Basic contacts**: Just name and email
- **Enriched contacts**: Full profile data from Apollo/Lusha
- **Activated contacts**: Have access to client portal (`firebaseUid`, `isActivated`)
- **Owner contacts**: Can own their own CompanyHQ (`role: "owner"`, `ownerId`)

## Prisma Database Model (Source of Truth)

**Location**: `prisma/schema.prisma`

```prisma
model Contact {
  id                  String    @id @default(cuid())
  crmId               String // CompanyHQId (tenant identifier) - renamed from companyId for clarity
  firstName           String?
  lastName            String?
  fullName            String? // Full name from enrichment
  goesBy              String?
  email               String?   @unique
  phone               String?
  title               String?
  seniority           String? // Seniority level from enrichment
  department          String? // Department from enrichment
  linkedinUrl         String? // LinkedIn URL from enrichment
  city                String? // City from enrichment
  state               String? // State from enrichment
  country             String? // Country from enrichment
  contactCompanyId    String? // Company they work for (prospect/client company)
  buyerDecision       String?
  howMet              String?
  notes               String? // Notes/context about the contact
  contactListId       String?
  domain              String? // Domain inferred from email (e.g., "businesspointlaw.com")
  companyName         String? // Company name from enrichment
  companyDomain       String? // Company domain from enrichment (e.g., "example.com")
  enrichmentSource    String? // Source of enrichment (e.g., "Lusha", "Apollo")
  enrichmentFetchedAt DateTime? // When enrichment was fetched
  enrichmentPayload   Json? // Full enrichment payload
  createdById         String? // User who created this contact

  // Client Portal Activation
  firebaseUid     String?   @unique // Firebase Auth UID
  clientPortalUrl String?   @default("https://clientportal.ignitegrowth.biz") // Portal URL for this contact
  isActivated     Boolean   @default(false) // Has completed activation flow
  activatedAt     DateTime? // When activation was completed

  // Elevation to Owner
  ownerId String? // Contact.id (self-reference when they become owner of their own HQ)
  role    String  @default("contact") // "contact" | "owner"

  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt
  companyHQ      CompanyHQ               @relation(fields: [crmId], references: [id])
  contactCompany Company?                @relation(fields: [contactCompanyId], references: [id])
  contactList    ContactList?            @relation(fields: [contactListId], references: [id])
  pipeline       Pipeline?
  deliverables   ConsultantDeliverable[]
  invites        InviteToken[] // Invite tokens for activation
  ownedHQs       CompanyHQ[]             @relation("ContactOwnedHQs") // HQs owned by this Contact
  proposals      Proposal[] // Proposals for this contact
  workPackages   WorkPackage[] // Work packages for this contact
  // Note: memberships are queried via firebaseUid, not direct relation (due to nullable firebaseUid)

  @@index([email])
  @@index([firebaseUid])
  @@index([ownerId])
  @@index([role])
  @@index([domain])
  @@map("contacts")
}
```

## Field Categories

### Identity Fields
- `id`: Primary key (cuid)
- `crmId`: CompanyHQ ID (tenant identifier) - **Required**
- `firstName`: First name
- `lastName`: Last name
- `fullName`: Full name (from enrichment or manual entry)
- `goesBy`: Preferred name/nickname
- `email`: Email address (**@unique** - one contact per email)
- `phone`: Phone number

### Professional Fields
- `title`: Job title/role
- `seniority`: Seniority level (from enrichment)
- `department`: Department (from enrichment)
- `linkedinUrl`: LinkedIn profile URL (from enrichment)

### Location Fields
- `city`: City (from enrichment)
- `state`: State (from enrichment)
- `country`: Country (from enrichment)

### Company Association
- `contactCompanyId`: Foreign key to `Company` model (company they work for)
- `companyName`: Company name (from enrichment, denormalized for quick access)
- `companyDomain`: Company domain (from enrichment, e.g., "example.com")
- `domain`: Domain inferred from email (e.g., "businesspointlaw.com")

### Relationship Fields
- `buyerDecision`: Decision-making authority/role
- `howMet`: How you met this contact
- `notes`: Free-text notes about the contact
- `contactListId`: Foreign key to `ContactList` (for list management)
- `createdById`: User who created this contact

### Enrichment Fields
- `enrichmentSource`: Source of enrichment data ("Lusha", "Apollo", etc.)
- `enrichmentFetchedAt`: Timestamp when enrichment was fetched
- `enrichmentPayload`: Full enrichment JSON payload (stored for reference)

### Client Portal Fields
- `firebaseUid`: Firebase Auth UID (**@unique**) - enables client portal access
- `clientPortalUrl`: Portal URL for this contact (default: "https://clientportal.ignitegrowth.biz")
- `isActivated`: Boolean flag - has completed activation flow (default: false)
- `activatedAt`: Timestamp when activation was completed

### Owner Elevation Fields
- `ownerId`: Self-reference - Contact.id when they become owner of their own HQ
- `role`: Role enum - "contact" (default) | "owner"

### Metadata Fields
- `createdAt`: Timestamp when contact was created
- `updatedAt`: Timestamp when contact was last updated

## Relationships

### 1. CompanyHQ (Many-to-One)
```prisma
companyHQ CompanyHQ @relation(fields: [crmId], references: [id])
```
- **Purpose**: Tenant scoping - all contacts belong to a CompanyHQ
- **Field**: `crmId` (CompanyHQ ID)
- **Required**: Yes
- **Cascade**: No (contacts persist if HQ is deleted, but relation breaks)

### 2. Company (Many-to-One)
```prisma
contactCompany Company? @relation(fields: [contactCompanyId], references: [id])
```
- **Purpose**: Company the contact works for
- **Field**: `contactCompanyId`
- **Required**: No (contact may not be associated with a company)
- **Note**: This is the prospect/client company, not your CompanyHQ

### 3. ContactList (Many-to-One)
```prisma
contactList ContactList? @relation(fields: [contactListId], references: [id])
```
- **Purpose**: List membership for segmentation
- **Field**: `contactListId`
- **Required**: No (contact may not be in any list)

### 4. Pipeline (One-to-One)
```prisma
pipeline Pipeline?
```
- **Purpose**: Sales pipeline tracking
- **Field**: `Pipeline.contactId` (unique)
- **Required**: No (contact may not be in pipeline)

### 5. ConsultantDeliverable (One-to-Many)
```prisma
deliverables ConsultantDeliverable[]
```
- **Purpose**: Work deliverables for this contact (client)
- **Field**: `ConsultantDeliverable.contactId`
- **Required**: No

### 6. InviteToken (One-to-Many)
```prisma
invites InviteToken[] // Invite tokens for activation
```
- **Purpose**: Invite tokens for client portal activation
- **Field**: `InviteToken.contactId`
- **Required**: No

### 7. CompanyHQ (One-to-Many via ContactOwnedHQs)
```prisma
ownedHQs CompanyHQ[] @relation("ContactOwnedHQs") // HQs owned by this Contact
```
- **Purpose**: When contact becomes owner, they can own multiple HQs
- **Field**: `CompanyHQ.contactOwnerId`
- **Required**: No (only for owner contacts)

### 8. Proposal (One-to-Many)
```prisma
proposals Proposal[] // Proposals for this contact
```
- **Purpose**: Proposals sent to this contact
- **Field**: `Proposal.contactId`
- **Required**: No

### 9. WorkPackage (One-to-Many)
```prisma
workPackages WorkPackage[] // Work packages for this contact
```
- **Purpose**: Work packages for this contact (client)
- **Field**: `WorkPackage.contactId`
- **Required**: No

### 10. CompanyMembership (Indirect via firebaseUid)
```prisma
// Note: memberships are queried via firebaseUid, not direct relation (due to nullable firebaseUid)
```
- **Purpose**: Multi-HQ access for activated contacts
- **Field**: `CompanyMembership.userId` (stores `firebaseUid` as string)
- **Query**: Manual query via `firebaseUid` (not Prisma relation due to nullable field)

## Indexes

```prisma
@@index([email])
@@index([firebaseUid])
@@index([ownerId])
@@index([role])
@@index([domain])
```

**Purpose**:
- `email`: Fast lookup by email (unique constraint also enforces uniqueness)
- `firebaseUid`: Fast lookup for client portal authentication
- `ownerId`: Fast lookup for owner contacts
- `role`: Fast filtering by role (contact vs owner)
- `domain`: Fast lookup by email domain

## Related Models

### Company Model
```prisma
model Company {
  id              String        @id @default(cuid())
  companyHQId     String
  companyName     String
  address         String?
  industry        String?
  website         String? // Website URL (inferred from email domain or manually entered)
  revenue         Float?
  yearsInBusiness Int?
  proposalId      String?
  contractId      String?
  invoiceId       String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  companyHQ       CompanyHQ     @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  contacts        Contact[]
  proposals       Proposal[] // Proposals linked to this company
  workPackages    WorkPackage[] // Work packages for this company

  @@map("companies")
}
```

**Relationship**: `Contact.contactCompanyId` → `Company.id`
- **Purpose**: Links contact to the company they work for
- **Note**: Company is separate from CompanyHQ (your company)

### CompanyHQ Model
```prisma
model CompanyHQ {
  id                   String                  @id @default(cuid())
  companyName          String
  companyStreet        String? // Street address
  companyCity          String? // City
  companyState         String? // State
  companyWebsite       String? // Website URL (for LinkedIn extraction, etc.)
  whatYouDo            String? // What the company does (description)
  companyIndustry      String?
  companyAnnualRev     Float?
  yearsInBusiness      Int?
  teamSize             String? // Team size for company (e.g., "just-me", "2-10", "11-50", "51-200", "200+")
  createdAt            DateTime                @default(now())
  updatedAt            DateTime                @updatedAt
  ownerId              String? // Owner.id (for legacy Owner model) - optional for Contact-owned HQs
  contactOwnerId       String? // Contact.id (for Contact-owned HQs) - when Contact becomes owner
  managerId            String?
  companies            Company[]
  manager              Owner?                  @relation("ManagerOf", fields: [managerId], references: [id])
  owner                Owner?                  @relation("OwnerOf", fields: [ownerId], references: [id]) // Made optional
  contactOwner         Contact?                @relation("ContactOwnedHQs", fields: [contactOwnerId], references: [id]) // Contact who owns this HQ
  contactLists         ContactList[]
  contacts             Contact[]
  proposals            Proposal[]
  products             Product[]
  personas             Persona[]
  assessments          Assessment[]
  memberships          CompanyMembership[] // Junction table for multi-HQ access
  domainRegistry       DomainRegistry? // Domain registry entry (one-to-one)
  deliverables         ConsultantDeliverable[] // Client delivery deliverables
  phaseTemplates       PhaseTemplate[]
  deliverableTemplates DeliverableTemplate[]
  blogs                Blog[]
  templates            Template[]
  eventPlans           EventPlan[]
  cleDecks             CleDeck[]
  landingPages         LandingPage[]

  @@map("company_hqs")
}
```

**Relationship**: `Contact.crmId` → `CompanyHQ.id`
- **Purpose**: Tenant scoping - all contacts belong to a CompanyHQ
- **Bidirectional**: `Contact.ownedHQs` → `CompanyHQ.contactOwnerId` (when contact becomes owner)

### ContactList Model
```prisma
model ContactList {
  id          String    @id @default(cuid())
  companyId   String
  name        String
  description String?
  type        String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  companyHQ   CompanyHQ @relation(fields: [companyId], references: [id], onDelete: Cascade)
  contacts    Contact[]

  @@map("contact_lists")
}
```

**Relationship**: `Contact.contactListId` → `ContactList.id`
- **Purpose**: List membership for segmentation and organization

### Pipeline Model
```prisma
model Pipeline {
  id        String   @id @default(cuid())
  contactId String   @unique
  pipeline  String
  stage     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  contact   Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@map("pipelines")
}
```

**Relationship**: `Pipeline.contactId` → `Contact.id` (one-to-one, unique)
- **Purpose**: Sales pipeline tracking per contact

## Field-by-Field Specification

### Identity Fields

#### `id` (String, required, primary key)
- **Type**: `@id @default(cuid())`
- **Purpose**: Unique identifier for the contact
- **Example**: `"clx123abc456def789"`
- **Notes**: Auto-generated by Prisma

#### `crmId` (String, required)
- **Type**: `String` (no default)
- **Purpose**: CompanyHQ ID - tenant identifier
- **Example**: `"hq_abc123"`
- **Notes**: 
  - Renamed from `companyId` for clarity
  - Links contact to tenant (CompanyHQ)
  - Required for multi-tenancy

#### `firstName` (String, optional)
- **Type**: `String?`
- **Purpose**: Contact's first name
- **Example**: `"John"`
- **Source**: Manual entry or enrichment

#### `lastName` (String, optional)
- **Type**: `String?`
- **Purpose**: Contact's last name
- **Example**: `"Doe"`
- **Source**: Manual entry or enrichment

#### `fullName` (String, optional)
- **Type**: `String?`
- **Purpose**: Full name (from enrichment or computed)
- **Example**: `"John Doe"`
- **Source**: Enrichment (`enrichmentPayload.person.name`) or computed from `firstName + lastName`

#### `goesBy` (String, optional)
- **Type**: `String?`
- **Purpose**: Preferred name/nickname
- **Example**: `"Johnny"`
- **Source**: Manual entry

#### `email` (String, optional, unique)
- **Type**: `String? @unique`
- **Purpose**: Email address (unique constraint)
- **Example**: `"john.doe@example.com"`
- **Source**: Manual entry or enrichment
- **Notes**: 
  - **@unique** - only one contact per email
  - Used for deduplication
  - Indexed for fast lookup

#### `phone` (String, optional)
- **Type**: `String?`
- **Purpose**: Phone number
- **Example**: `"+1-555-123-4567"`
- **Source**: Manual entry or enrichment

### Professional Fields

#### `title` (String, optional)
- **Type**: `String?`
- **Purpose**: Job title/role
- **Example**: `"CEO"`, `"Head of Sales"`
- **Source**: Manual entry or enrichment (`enrichmentPayload.person.title`)

#### `seniority` (String, optional)
- **Type**: `String?`
- **Purpose**: Seniority level
- **Example**: `"senior"`, `"executive"`, `"director"`
- **Source**: Enrichment (`enrichmentPayload.person.seniority`)

#### `department` (String, optional)
- **Type**: `String?`
- **Purpose**: Department
- **Example**: `"Engineering"`, `"Sales"`, `"Marketing"`
- **Source**: Enrichment (`enrichmentPayload.person.department`)

#### `linkedinUrl` (String, optional)
- **Type**: `String?`
- **Purpose**: LinkedIn profile URL
- **Example**: `"https://linkedin.com/in/john-doe"`
- **Source**: Enrichment (`enrichmentPayload.person.linkedin_url`)

### Location Fields

#### `city` (String, optional)
- **Type**: `String?`
- **Purpose**: City
- **Example**: `"San Francisco"`
- **Source**: Enrichment (`enrichmentPayload.person.city`)

#### `state` (String, optional)
- **Type**: `String?`
- **Purpose**: State/Province
- **Example**: `"CA"`, `"California"`
- **Source**: Enrichment (`enrichmentPayload.person.state`)

#### `country` (String, optional)
- **Type**: `String?`
- **Purpose**: Country
- **Example**: `"United States"`
- **Source**: Enrichment (`enrichmentPayload.person.country`)

### Company Association Fields

#### `contactCompanyId` (String, optional)
- **Type**: `String?`
- **Purpose**: Foreign key to `Company` model (company they work for)
- **Example**: `"company_abc123"`
- **Notes**: Links to prospect/client company, not your CompanyHQ

#### `companyName` (String, optional)
- **Type**: `String?`
- **Purpose**: Company name (denormalized from enrichment)
- **Example**: `"Example Corp"`
- **Source**: Enrichment (`enrichmentPayload.person.organization.name`)
- **Notes**: Denormalized for quick access without join

#### `companyDomain` (String, optional)
- **Type**: `String?`
- **Purpose**: Company domain (from enrichment)
- **Example**: `"example.com"`
- **Source**: Enrichment (`enrichmentPayload.person.organization.primary_domain`)

#### `domain` (String, optional)
- **Type**: `String?`
- **Purpose**: Domain inferred from email
- **Example**: `"businesspointlaw.com"` (from email `john@businesspointlaw.com`)
- **Source**: Computed from `email` field
- **Notes**: Used for domain-based company matching

### Relationship Fields

#### `buyerDecision` (String, optional)
- **Type**: `String?`
- **Purpose**: Decision-making authority/role
- **Example**: `"Decision Maker"`, `"Influencer"`, `"End User"`
- **Source**: Manual entry

#### `howMet` (String, optional)
- **Type**: `String?`
- **Purpose**: How you met this contact
- **Example**: `"LinkedIn"`, `"Referral"`, `"Event"`
- **Source**: Manual entry

#### `notes` (String, optional)
- **Type**: `String?`
- **Purpose**: Free-text notes about the contact
- **Example**: `"Met at conference. Interested in BD automation."`
- **Source**: Manual entry
- **Notes**: Used in BD Intelligence scoring (persona matching)

#### `contactListId` (String, optional)
- **Type**: `String?`
- **Purpose**: Foreign key to `ContactList` model
- **Example**: `"list_abc123"`
- **Notes**: For list segmentation

#### `createdById` (String, optional)
- **Type**: `String?`
- **Purpose**: User who created this contact
- **Example**: `"user_abc123"`
- **Source**: Set on creation

### Enrichment Fields

#### `enrichmentSource` (String, optional)
- **Type**: `String?`
- **Purpose**: Source of enrichment data
- **Example**: `"Apollo"`, `"Lusha"`
- **Source**: Set when enrichment is performed

#### `enrichmentFetchedAt` (DateTime, optional)
- **Type**: `DateTime?`
- **Purpose**: Timestamp when enrichment was fetched
- **Example**: `2024-01-15T10:30:00Z`
- **Source**: Set when enrichment is performed

#### `enrichmentPayload` (Json, optional)
- **Type**: `Json?`
- **Purpose**: Full enrichment JSON payload
- **Example**: `{ "person": { "id": "...", "name": "John Doe", ... } }`
- **Source**: Stored from enrichment API response
- **Notes**: 
  - Stores complete Apollo/Lusha response
  - Used for reference and future extraction
  - Can be used for persona generation

### Client Portal Fields

#### `firebaseUid` (String, optional, unique)
- **Type**: `String? @unique`
- **Purpose**: Firebase Auth UID for client portal access
- **Example**: `"firebase_abc123"`
- **Source**: Set when contact activates client portal
- **Notes**: 
  - **@unique** - one contact per Firebase UID
  - Indexed for fast lookup
  - Used for authentication in client portal

#### `clientPortalUrl` (String, optional)
- **Type**: `String? @default("https://clientportal.ignitegrowth.biz")`
- **Purpose**: Portal URL for this contact
- **Example**: `"https://clientportal.ignitegrowth.biz"`
- **Default**: `"https://clientportal.ignitegrowth.biz"`

#### `isActivated` (Boolean, required, default: false)
- **Type**: `Boolean @default(false)`
- **Purpose**: Has completed activation flow
- **Example**: `true`, `false`
- **Default**: `false`

#### `activatedAt` (DateTime, optional)
- **Type**: `DateTime?`
- **Purpose**: Timestamp when activation was completed
- **Example**: `2024-01-15T10:30:00Z`
- **Source**: Set when `isActivated` becomes `true`

### Owner Elevation Fields

#### `ownerId` (String, optional)
- **Type**: `String?`
- **Purpose**: Self-reference - Contact.id when they become owner
- **Example**: `"contact_abc123"` (same as `Contact.id`)
- **Notes**: 
  - Self-referential field
  - Set when contact is elevated to owner role
  - Indexed for fast lookup

#### `role` (String, required, default: "contact")
- **Type**: `String @default("contact")`
- **Purpose**: Role enum - "contact" | "owner"
- **Example**: `"contact"`, `"owner"`
- **Default**: `"contact"`
- **Notes**: 
  - Indexed for fast filtering
  - Determines if contact can own CompanyHQs

### Metadata Fields

#### `createdAt` (DateTime, required)
- **Type**: `DateTime @default(now())`
- **Purpose**: Timestamp when contact was created
- **Example**: `2024-01-15T10:30:00Z`
- **Auto-set**: Yes (Prisma)

#### `updatedAt` (DateTime, required)
- **Type**: `DateTime @updatedAt`
- **Purpose**: Timestamp when contact was last updated
- **Example**: `2024-01-15T10:30:00Z`
- **Auto-set**: Yes (Prisma, on every update)

## Enrichment Data Mapping

When a contact is enriched via Apollo, the following mapping occurs:

| Apollo Field | Contact Field | Notes |
|--------------|---------------|-------|
| `person.email` | `email` | Email address (from LinkedIn enrichment) |
| `person.name` | `fullName` | Full name |
| `person.first_name` | `firstName` | First name |
| `person.last_name` | `lastName` | Last name |
| `person.title` | `title` | Job title |
| `person.seniority` | `seniority` | Seniority level |
| `person.department` | `department` | Department |
| `person.linkedin_url` | `linkedinUrl` | LinkedIn profile URL |
| `person.phone_numbers[0]` | `phone` | Primary phone number |
| `person.city` | `city` | City |
| `person.state` | `state` | State |
| `person.country` | `country` | Country |
| `person.organization.name` | `companyName` | Company name |
| `person.organization.primary_domain` | `companyDomain` | Company domain |
| Full response | `enrichmentPayload` | Complete JSON response |

**Enrichment Process**:
1. Call Apollo API with email or LinkedIn URL
2. Receive `ApolloPersonMatchResponse`
3. Normalize using `normalizeApolloResponse()`
4. Update Contact fields (only if values exist)
5. Store full response in `enrichmentPayload`
6. Set `enrichmentSource: "Apollo"` and `enrichmentFetchedAt: new Date()`

## Contact Lifecycle

### 1. Basic Contact Creation
```
User creates contact with minimal data:
- firstName, lastName (or fullName)
- email (required for uniqueness)
- crmId (required for tenant scoping)
```

### 2. Enrichment
```
User enriches contact:
- Calls /api/contacts/enrich or /api/enrich/enrich
- Apollo returns full profile data
- Contact fields updated (if values exist)
- enrichmentPayload stored
- enrichmentSource and enrichmentFetchedAt set
```

### 3. Client Portal Activation
```
Contact activates client portal:
- InviteToken created
- Contact receives invite link
- Contact completes activation flow
- firebaseUid set (Firebase Auth UID)
- isActivated: true
- activatedAt: new Date()
```

### 4. Owner Elevation
```
Contact becomes owner:
- role: "owner"
- ownerId: Contact.id (self-reference)
- Can own CompanyHQs via CompanyHQ.contactOwnerId
```

## Usage Patterns

### 1. Prospect Management
- **Create**: Basic contact with name and email
- **Enrich**: Get full profile from Apollo
- **Track**: Add to pipeline, assign to contact list
- **Engage**: Send proposals, create work packages

### 2. Client Management
- **Activate**: Invite to client portal
- **Deliver**: Create deliverables, work packages
- **Track**: Monitor proposals, invoices, work progress

### 3. Persona Matching
- **BD Intelligence**: Uses `notes`, `title`, `contactCompany.industry` for persona matching
- **Auto-match**: Persona mapper finds best matching persona
- **Scoring**: Persona data enriches fit score calculations

### 4. Multi-HQ Access
- **Membership**: Contact can belong to multiple CompanyHQs via `CompanyMembership`
- **Query**: Look up memberships via `firebaseUid` (not direct relation)
- **Primary**: One HQ marked as `isPrimary: true`

## Key Design Decisions

### 1. Contact vs Company Separation
- **Contact**: Represents a person
- **Company**: Represents an organization
- **Relationship**: `Contact.contactCompanyId` → `Company.id`
- **Rationale**: One person, one company (current role), but company can have many contacts

### 2. Email Uniqueness
- **Constraint**: `email @unique`
- **Rationale**: Prevents duplicate contacts
- **Edge Case**: Contacts without email can't be deduplicated automatically

### 3. Tenant Scoping via crmId
- **Field**: `crmId` (CompanyHQ ID)
- **Rationale**: Multi-tenancy - each CompanyHQ has isolated contacts
- **Query**: Always filter by `crmId` for tenant isolation

### 4. Enrichment Payload Storage
- **Field**: `enrichmentPayload` (Json)
- **Rationale**: Store full response for future use (persona generation, re-extraction)
- **TTL**: No TTL - stored permanently (unlike Redis storage)

### 5. Client Portal Activation
- **Field**: `firebaseUid` (unique)
- **Rationale**: Enables Firebase Auth for client portal
- **Query**: Look up memberships via `firebaseUid` (not direct relation due to nullable field)

### 6. Owner Elevation
- **Field**: `role` (default: "contact")
- **Field**: `ownerId` (self-reference)
- **Rationale**: Contacts can become owners of their own CompanyHQs
- **Use Case**: Client becomes owner, creates their own HQ

## Data Flow Examples

### Enrichment Flow
```
[User enters LinkedIn URL]
        ↓
[POST /api/enrich/enrich]
        ↓
[Apollo API call]
        ↓
[normalizeApolloResponse()]
        ↓
[Update Contact fields]
        ↓
[Store enrichmentPayload]
        ↓
[Set enrichmentSource + enrichmentFetchedAt]
```

### Persona Matching Flow
```
[Contact exists with title, industry, notes]
        ↓
[BD Intelligence calculates fit score]
        ↓
[findMatchingPersona() called]
        ↓
[Matches contact.title vs persona.title]
[Matches contact.contactCompany.industry vs persona.industry]
[Matches contact.notes vs persona.goals/painPoints]
        ↓
[Returns best match with confidence score]
        ↓
[Persona data used in fit score calculation]
```

### Client Portal Activation Flow
```
[Contact created]
        ↓
[InviteToken created]
        ↓
[Contact receives invite link]
        ↓
[Contact completes activation]
        ↓
[firebaseUid set (Firebase Auth)]
        ↓
[isActivated: true]
        ↓
[activatedAt: new Date()]
        ↓
[CompanyMembership created for access]
```

## Current State

✅ **Contact Model**: Complete Prisma schema with all fields  
✅ **Enrichment Integration**: Apollo enrichment working  
✅ **Client Portal**: Activation flow implemented  
✅ **Owner Elevation**: Contacts can become owners  
✅ **Multi-Tenancy**: Scoped to CompanyHQ via crmId  
✅ **Relationships**: All relationships defined  
✅ **Indexes**: Optimized for common queries  

The Contact model is production-ready and serves as the central entity for all human relationships in the IgniteBD system.

