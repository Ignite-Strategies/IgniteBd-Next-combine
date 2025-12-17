/**
 * WorkPackage CSV Field Mapper
 * Maps CSV columns to system fields with fuzzy matching
 */

// System fields available for mapping
export const SYSTEM_FIELDS = {
  // WorkPackage (global - applies to first row or all rows)
  workPackage: {
    title: { label: 'Work Package Title', required: false, category: 'workPackage' },
    description: { label: 'Work Package Description', required: false, category: 'workPackage' },
    totalCost: { label: 'Total Cost', required: false, category: 'workPackage' },
    effectiveStartDate: { label: 'Effective Start Date', required: false, category: 'workPackage' },
  },
  // WorkPackagePhase
  phase: {
    name: { label: 'Phase Name', required: true, category: 'phase' },
    position: { label: 'Phase Position', required: true, category: 'phase' },
    phaseDescription: { label: 'Phase Description', required: false, category: 'phase' },
  },
  // WorkPackageItem
  item: {
    deliverableLabel: { label: 'Deliverable Label', required: true, category: 'item' },
    deliverableType: { label: 'Deliverable Type', required: true, category: 'item' },
    deliverableDescription: { label: 'Deliverable Description', required: false, category: 'item' },
    quantity: { label: 'Quantity', required: true, category: 'item' },
    estimatedHoursEach: { label: 'Estimated Hours Each', required: true, category: 'item' },
    unitOfMeasure: { label: 'Unit of Measure', required: false, category: 'item' },
    status: { label: 'Status', required: false, category: 'item' },
  },
};

// Get all system fields as flat array for dropdown
export function getAllSystemFields() {
  return [
    ...Object.entries(SYSTEM_FIELDS.workPackage).map(([key, value]) => ({ key, ...value })),
    ...Object.entries(SYSTEM_FIELDS.phase).map(([key, value]) => ({ key, ...value })),
    ...Object.entries(SYSTEM_FIELDS.item).map(([key, value]) => ({ key, ...value })),
    { key: 'unmapped', label: 'Ignore Column', required: false, category: 'ignore' },
  ];
}

// Fuzzy match CSV header to system field
export function fuzzyMatchHeader(csvHeader) {
  const header = csvHeader.toLowerCase().trim().replace(/[-_\s]/g, '');
  const allFields = getAllSystemFields();
  
  // First check aliases (most common patterns)
  const aliases = {
    // Work Package fields
    'proposaltitle': 'title',
    'proposaltotalcost': 'totalCost',
    'proposaldescription': 'description',
    'proposalnotes': 'description',
    'workpackagetitle': 'title',
    'workpackagedescription': 'description',
    'workpackagetotalcost': 'totalCost',
    
    // Phase fields
    'phasename': 'name',
    'phaseposition': 'position',
    'phasedescription': 'phaseDescription',
    
    // Item/Deliverable fields
    'deliverablelabel': 'deliverableLabel',
    'deliverablename': 'deliverableLabel',
    'itemlabel': 'deliverableLabel',
    'itemname': 'deliverableLabel',
    'deliverabletype': 'deliverableType',
    'itemtype': 'deliverableType',
    'deliverabledescription': 'deliverableDescription',
    'itemdescription': 'deliverableDescription',
    'quantity': 'quantity',
    'qty': 'quantity',
    'estimatedhourseach': 'estimatedHoursEach',
    'hourseach': 'estimatedHoursEach',
    'hours': 'estimatedHoursEach',
    'unitofmeasure': 'unitOfMeasure',
    'unit': 'unitOfMeasure',
    'status': 'status',
  };
  
  // Check aliases first (exact match after normalization)
  if (aliases[header]) {
    return aliases[header];
  }
  
  // Exact matches with original field names
  for (const field of allFields) {
    if (field.key === 'unmapped') continue;
    const normalizedFieldKey = field.key.toLowerCase().replace(/[-_\s]/g, '');
    const normalizedFieldLabel = field.label.toLowerCase().replace(/[-_\s]/g, '');
    
    if (header === normalizedFieldKey || header === normalizedFieldLabel) {
      return field.key;
    }
  }
  
  // Partial matches (check if header contains field name or vice versa)
  const matches = [];
  for (const field of allFields) {
    if (field.key === 'unmapped') continue;
    const fieldLabel = field.label.toLowerCase().replace(/[-_\s]/g, '');
    const fieldKey = field.key.toLowerCase().replace(/[-_\s]/g, '');
    
    // Check if header contains field name or field name contains header
    if (header.includes(fieldKey) || fieldKey.includes(header) ||
        header.includes(fieldLabel) || fieldLabel.includes(header)) {
      // Score based on match quality (exact > contains)
      const score = (header === fieldKey || header === fieldLabel) ? 2 : 1;
      matches.push({ field: field.key, score });
    }
  }
  
  // Sort by score (best match first)
  if (matches.length > 0) {
    matches.sort((a, b) => b.score - a.score);
    return matches[0].field;
  }
  
  // Common aliases - improved matching
  const aliases = {
    // Work Package fields
    'proposaltitle': 'title',
    'proposal_title': 'title',
    'proposal-title': 'title',
    'workpackagetitle': 'title',
    'work_package_title': 'title',
    
    // Work Package description (not phase description)
    'proposaldescription': 'description',
    'proposal_description': 'description',
    'proposal-description': 'description',
    'workpackagedescription': 'description',
    'work_package_description': 'description',
    'proposalnotes': 'description', // Notes map to work package description
    'proposal_notes': 'description',
    'proposal-notes': 'description',
    
    // Phase description (separate from work package description)
    'phasedescription': 'phaseDescription',
    'phase_description': 'phaseDescription',
    'phase-description': 'phaseDescription',
    
    'proposaltotalcost': 'totalCost',
    'proposal_total_cost': 'totalCost',
    'proposal-total-cost': 'totalCost',
    'totalcost': 'totalCost',
    'total_cost': 'totalCost',
    'cost': 'totalCost',
    
    'effectivestartdate': 'effectiveStartDate',
    'effective_start_date': 'effectiveStartDate',
    'startdate': 'effectiveStartDate',
    'start_date': 'effectiveStartDate',
    
    // Phase fields
    'phasename': 'name',
    'phase_name': 'name',
    'phase-name': 'name',
    'phase': 'name',
    
    'phaseposition': 'position',
    'phase_position': 'position',
    'phase-position': 'position',
    'position': 'position',
    
    // Already handled above - phaseDescription
    
    // Item/Deliverable fields
    'deliverablelabel': 'deliverableLabel',
    'deliverable_label': 'deliverableLabel',
    'deliverable-label': 'deliverableLabel',
    'deliverablename': 'deliverableLabel',
    'itemlabel': 'deliverableLabel',
    'item_label': 'deliverableLabel',
    'itemname': 'deliverableLabel',
    'item_name': 'deliverableLabel',
    
    'deliverabletype': 'deliverableType',
    'deliverable_type': 'deliverableType',
    'deliverable-type': 'deliverableType',
    'itemtype': 'deliverableType',
    'item_type': 'deliverableType',
    
    'deliverabledescription': 'deliverableDescription',
    'deliverable_description': 'deliverableDescription',
    'deliverable-description': 'deliverableDescription',
    'itemdescription': 'deliverableDescription',
    'item_description': 'deliverableDescription',
    
    'quantity': 'quantity',
    'qty': 'quantity',
    'amount': 'quantity',
    
    'estimatedhourseach': 'estimatedHoursEach',
    'estimated_hours_each': 'estimatedHoursEach',
    'estimated-hours-each': 'estimatedHoursEach',
    'hours': 'estimatedHoursEach',
    'hourseach': 'estimatedHoursEach',
    
    'unitofmeasure': 'unitOfMeasure',
    'unit_of_measure': 'unitOfMeasure',
    'unit-of-measure': 'unitOfMeasure',
    'unit': 'unitOfMeasure',
    'uom': 'unitOfMeasure',
    
    'status': 'status',
  };
  
  // Check aliases (exact match)
  if (aliases[header]) {
    return aliases[header];
  }
  
  // Check aliases with common separators removed
  const normalizedHeader = header.replace(/[-_\s]/g, '');
  if (aliases[normalizedHeader]) {
    return aliases[normalizedHeader];
  }
  
  return null;
}

// Auto-generate mappings from CSV headers
export function generateMappings(csvHeaders) {
  const mappings = {};
  
  for (const header of csvHeaders) {
    const matched = fuzzyMatchHeader(header);
    mappings[header] = matched || 'unmapped';
  }
  
  return mappings;
}

// Validate mappings
export function validateMappings(mappings, csvHeaders) {
  const errors = [];
  const warnings = [];
  
  // Check required fields
  const requiredFields = [
    ...Object.entries(SYSTEM_FIELDS.phase).filter(([_, v]) => v.required).map(([k]) => k),
    ...Object.entries(SYSTEM_FIELDS.item).filter(([_, v]) => v.required).map(([k]) => k),
  ];
  
  const mappedFields = Object.values(mappings).filter(f => f !== 'unmapped');
  const missingRequired = requiredFields.filter(req => !mappedFields.includes(req));
  
  if (missingRequired.length > 0) {
    errors.push(`Missing required fields: ${missingRequired.join(', ')}`);
  }
  
  // Check for duplicate mappings (except unmapped)
  const mappedCounts = {};
  for (const field of mappedFields) {
    mappedCounts[field] = (mappedCounts[field] || 0) + 1;
  }
  
  for (const [field, count] of Object.entries(mappedCounts)) {
    if (count > 1) {
      warnings.push(`Field "${field}" is mapped from multiple CSV columns`);
    }
  }
  
  return { errors, warnings, isValid: errors.length === 0 };
}

// Transform CSV rows using mappings
export function transformRows(csvRows, mappings) {
  const transformed = [];
  
  for (const row of csvRows) {
    const transformedRow = {};
    
    for (const [csvHeader, systemField] of Object.entries(mappings)) {
      if (systemField === 'unmapped' || !row[csvHeader]) continue;
      
      const value = row[csvHeader].trim();
      
      // Type conversions
      if (systemField === 'position' || systemField === 'quantity' || systemField === 'estimatedHoursEach') {
        transformedRow[systemField] = parseInt(value, 10) || 0;
      } else if (systemField === 'totalCost') {
        transformedRow[systemField] = parseFloat(value) || 0;
      } else if (systemField === 'effectiveStartDate') {
        transformedRow[systemField] = value; // Keep as string, parse later
      } else {
        transformedRow[systemField] = value;
      }
    }
    
    transformed.push(transformedRow);
  }
  
  return transformed;
}

// Group transformed rows into phases and items
export function groupIntoPhases(transformedRows) {
  const phaseMap = new Map();
  
  for (const row of transformedRows) {
    const phaseKey = `${row.name || 'Unnamed Phase'}_${row.position || 0}`;
    
    if (!phaseMap.has(phaseKey)) {
      phaseMap.set(phaseKey, {
        name: row.name || 'Unnamed Phase',
        position: row.position || 0,
        description: row.phaseDescription || null, // Use phaseDescription, not description
        items: [],
      });
    }
    
    const phase = phaseMap.get(phaseKey);
    
    // Extract item data
    if (row.deliverableLabel) {
      phase.items.push({
        deliverableLabel: row.deliverableLabel,
        deliverableType: row.deliverableType || 'UNKNOWN',
        deliverableDescription: row.deliverableDescription || null,
        quantity: row.quantity || 1,
        estimatedHoursEach: row.estimatedHoursEach || 0,
        unitOfMeasure: row.unitOfMeasure || 'item',
        status: row.status || 'not_started',
      });
    }
  }
  
  // Convert to array and sort by position
  const phases = Array.from(phaseMap.values()).sort((a, b) => a.position - b.position);
  
  // Extract WorkPackage metadata from first row
  const firstRow = transformedRows[0] || {};
  const workPackage = {
    title: firstRow.title || 'Imported Work Package',
    description: firstRow.description || null,
    totalCost: firstRow.totalCost || null,
    effectiveStartDate: firstRow.effectiveStartDate || null,
  };
  
  // Calculate phase hours
  for (const phase of phases) {
    phase.totalEstimatedHours = phase.items.reduce((sum, item) => {
      return sum + (item.quantity * item.estimatedHoursEach);
    }, 0);
  }
  
  return { workPackage, phases };
}

