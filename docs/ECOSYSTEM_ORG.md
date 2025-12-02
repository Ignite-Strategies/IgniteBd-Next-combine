# EcosystemOrg - Quick Reference

**What it is**: The model for ecosystem organizations (associations, commercial producers, media, nonprofits, etc.)

---

## Model: EcosystemOrg

**File**: `prisma/schema.prisma`

```prisma
model EcosystemOrg {
  id               String   @id @default(cuid())

  // Raw ingest
  sourceType       EcosystemOrgSourceType @default(MANUAL)
  rawName          String
  rawWebsite       String?
  rawLocation      String?

  // Identity
  normalizedName   String
  organizationType OrganizationType  // ASSOCIATION, COMMERCIAL, MEDIA, NONPROFIT, GOVERNMENT

  // AI Enrichment
  description      String?
  whatTheyDo       String?
  howTheyMatter    String?
  industryTags     String[]
  authorityLevel   Int?        // 1–5
  sizeEstimate     String?
  memberTypes      String[]

  // BD Intelligence
  personaAlignment Json?       // { personaId: score }
  bdRelevanceScore Int?        // 0–100

  createdAt        DateTime @default(now())

  // Relations
  eventMetas       EventMeta[]
}
```

**Enums**:

```prisma
enum EcosystemOrgSourceType {
  MANUAL
  CSV
  EVENT
  AI
}

enum OrganizationType {
  ASSOCIATION
  COMMERCIAL
  MEDIA
  NONPROFIT
  GOVERNMENT
}
```

---

## API Routes

### POST /api/ecosystem/org/ingest
**Upload and ingest ecosystem organizations**

**Accepts**:
- CSV/XLSX file (FormData with `file`)
- Text list (FormData with `textList` - one org per line)
- Single entry (FormData with `name`, `website`, `location`)
- JSON array or object (body)

**Process**:
1. Parse input
2. For each org: Create record → Run AI inference → Update with enriched data
3. Returns list of created/updated orgs

**Response**:
```json
{
  "success": true,
  "count": 5,
  "orgs": [...],
  "errors": [] // if any
}
```

### GET /api/ecosystem/org/ingest
**List ecosystem organizations**

**Query params**:
- `limit` (default: 100)
- `offset` (default: 0)
- `organizationType` (optional: ASSOCIATION, COMMERCIAL, MEDIA, NONPROFIT, GOVERNMENT)

**Response**:
```json
{
  "success": true,
  "count": 5,
  "orgs": [...]
}
```

---

## Key Fields Explained

| Field | Type | Description |
|-------|------|-------------|
| `rawName` | String | Original name from upload |
| `normalizedName` | String | AI-normalized/standardized name |
| `organizationType` | Enum | ASSOCIATION, COMMERCIAL, MEDIA, NONPROFIT, GOVERNMENT |
| `whatTheyDo` | String? | What activities/services they perform |
| `howTheyMatter` | String? | Why this org matters for BD |
| `industryTags` | String[] | Array of industry tags |
| `authorityLevel` | Int? | 1=Local, 2=State, 3=National, 4=International, 5=Global |
| `bdRelevanceScore` | Int? | 0-100 BD relevance score |

---

## Usage

**Upload CSV**:
```javascript
const formData = new FormData();
formData.append('file', csvFile);
await api.post('/api/ecosystem/org/ingest', formData);
```

**Upload single org**:
```javascript
const formData = new FormData();
formData.append('name', 'American Marketing Association');
formData.append('website', 'ama.org');
formData.append('location', 'Chicago, IL');
await api.post('/api/ecosystem/org/ingest', formData);
```

**List orgs**:
```javascript
const response = await api.get('/api/ecosystem/org/ingest?organizationType=ASSOCIATION');
```

---

**Page**: `/ecosystem/associations`  
**Sidebar**: Growth Ops → "Ecosystem Intelligence"

