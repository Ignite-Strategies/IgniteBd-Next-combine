# Work Package CSV Import Template

## CSV Format

### Required Columns

| Column | Description | Example |
|--------|-------------|---------|
| `proposalDescription` | Full proposal description | "IgniteBD Starter Build-Out focusing on strategic foundation..." |
| `proposalTotalCost` | Total cost (numeric) | 1500 |
| `proposalNotes` | Additional notes | "Approved via email." |
| `phaseName` | Phase name | "BD Strategic Setup" |
| `phasePosition` | Phase order (1, 2, 3...) | 1 |
| `phaseDescription` | Phase description | "Establish the strategic foundation..." |
| `deliverableLabel` | Deliverable name | "Target Personas" |
| `deliverableType` | Deliverable type (uppercase) | PERSONA, BLOG, CLE_DECK, etc. |
| `deliverableDescription` | Deliverable description | "Develop 3 persona profiles..." |
| `quantity` | Quantity (number) | 3 |
| `unitOfMeasure` | Unit type | persona, item, event, etc. |
| `estimatedHoursEach` | Hours per unit (number) | 4 |
| `status` | Status | not_started, in_progress, completed |

### CSV Template

```csv
proposalDescription,proposalTotalCost,proposalNotes,phaseName,phasePosition,phaseDescription,deliverableLabel,deliverableType,deliverableDescription,quantity,unitOfMeasure,estimatedHoursEach,status
"IgniteBD Starter Build-Out focusing on strategic foundation, collateral, CRM setup, and campaign readiness.",1500,"Approved via email.","BD Strategic Setup",1,"Establish the strategic foundation for your BD system by defining targets, events, and opportunity landscape.","Target Personas",PERSONA,"Develop 3 persona profiles defining ideal BD targets.",3,persona,4,not_started
"IgniteBD Starter Build-Out focusing on strategic foundation, collateral, CRM setup, and campaign readiness.",1500,"Approved via email.","BD Strategic Setup",1,"Establish the strategic foundation for your BD system by defining targets, events, and opportunity landscape.","Event Selection",EVENT,"Identify 6 key industry events most likely to generate BD opportunities.",6,event,1,not_started
```

## Example CSV (Full)

See the provided CSV data in the user's request for a complete example with 17 rows.

## Field Details

### Proposal Fields (from first row)
- `proposalDescription` - Used for WorkPackage.description
- `proposalTotalCost` - Used for WorkPackage.totalCost
- `proposalNotes` - Optional metadata (can be stored or ignored)

### Phase Fields
- `phaseName` - WorkPackagePhase.name
- `phasePosition` - WorkPackagePhase.position (must be unique per package)
- `phaseDescription` - WorkPackagePhase.description

### Deliverable Fields
- `deliverableLabel` - WorkPackageItem.deliverableLabel (primary)
- `deliverableType` - WorkPackageItem.deliverableType (uppercase: PERSONA, BLOG, etc.)
- `deliverableDescription` - WorkPackageItem.deliverableDescription
- `quantity` - WorkPackageItem.quantity
- `unitOfMeasure` - WorkPackageItem.unitOfMeasure
- `estimatedHoursEach` - WorkPackageItem.estimatedHoursEach
- `status` - WorkPackageItem.status (not_started, in_progress, completed)

## Validation Rules

1. **Required fields** must be present and non-empty
2. **phasePosition** must be a positive integer
3. **quantity** must be a positive integer
4. **estimatedHoursEach** must be a non-negative integer
5. **proposalTotalCost** must be a valid number (if provided)
6. **deliverableType** should be uppercase (converted automatically)

## Idempotent Upsert Keys

- **WorkPackagePhase**: `[workPackageId, name, position]`
- **WorkPackageItem**: `[workPackageId, workPackagePhaseId, deliverableLabel]`

This means:
- Re-uploading the same CSV will update existing phases/items instead of creating duplicates
- Same phase name + position = same phase
- Same deliverable label in same phase = same item

## API Usage

### One-Shot Import
```javascript
const formData = new FormData();
formData.append('file', csvFile);
formData.append('contactId', 'contact-123');
formData.append('companyId', 'company-456');
formData.append('title', 'Starter Build-Out'); // Optional

const response = await fetch('/api/workpackages/import/one-shot', {
  method: 'POST',
  body: formData,
});
```

### Modular Import (3-Step)
```javascript
// Step 1: Create WorkPackage
await fetch('/api/workpackages/import/proposal', {
  method: 'POST',
  body: JSON.stringify({
    contactId: 'contact-123',
    companyId: 'company-456',
    title: 'Starter Build-Out',
    description: '...',
    totalCost: 1500,
  }),
});

// Step 2: Import Phases
await fetch('/api/workpackages/import/phases', {
  method: 'POST',
  body: JSON.stringify({
    workPackageId: 'wp-123',
    phases: [
      { name: 'BD Strategic Setup', position: 1, description: '...' },
      // ...
    ],
  }),
});

// Step 3: Import Items
await fetch('/api/workpackages/import/items', {
  method: 'POST',
  body: JSON.stringify({
    workPackageId: 'wp-123',
    items: [
      {
        workPackagePhaseId: 'phase-1',
        deliverableType: 'PERSONA',
        deliverableLabel: 'Target Personas',
        quantity: 3,
        estimatedHoursEach: 4,
        // ...
      },
      // ...
    ],
  }),
});
```

