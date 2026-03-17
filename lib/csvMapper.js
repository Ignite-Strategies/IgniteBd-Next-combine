/**
 * Universal CSV mapper: parse CSV and infer column → field mapping.
 * Used by contact upload and target submission (and any other CSV ingest).
 */

const DEFAULT_HEADER_HINTS = new Set([
  'first name', 'last name', 'firstname', 'lastname', 'first', 'last', 'fname', 'lname',
  'given name', 'family name', 'surname', 'email', 'email address', 'company', 'company name',
  'companyname', 'organization', 'org', 'title', 'job title', 'jobtitle', 'position', 'role',
  'url', 'linkedin', 'linkedin url', 'linkedinurl', 'profile url', 'profileurl', 'profile',
  'connected on', 'connectedon', 'date connected', 'phone', 'phone number', 'phonenumber', 'mobile',
  'notes', 'note', 'description', 'pipeline', 'stage', 'name', 'full name', 'contact name', 'person',
  'notes (from last engagement)', 'notes from last engagement', 'last engagement notes', 'additional context',
  'engagement history', 'last contact', 'relationship', 'aware of business', 'using competitor',
  'worked together at', 'prior work together', 'email if known',
]);

/**
 * Parse CSV text; preserve original header casing. If first line doesn't look like headers, treat as data.
 * @param {string} csvText
 * @param {{ headerHints?: Set<string> | string[] }} options - optional set (or array) of lowercase header phrases to detect header row
 * @returns {{ headers: string[], rows: Record<string,string>[], errors: string[], noHeaderRow: boolean }}
 */
export function parseCSVClient(csvText, options = {}) {
  const normalized = (typeof csvText === 'string' ? csvText : '').replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [], errors: [], noHeaderRow: false };

  const hintSet = options.headerHints
    ? new Set([...options.headerHints].map((h) => h.toLowerCase()))
    : DEFAULT_HEADER_HINTS;

  const parseLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const next = line[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else inQuotes = !inQuotes;
      } else if ((c === ',' && !inQuotes) || (c === '\t' && !inQuotes)) {
        out.push(cur.trim());
        cur = '';
      } else cur += c;
    }
    out.push(cur.trim());
    return out;
  };

  const firstLineVals = parseLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const firstLineLower = firstLineVals.map((c) => c.toLowerCase());
  const looksLikeHeader = firstLineLower.some((cell) => cell && hintSet.has(cell));
  const noHeaderRow = !looksLikeHeader;
  const headers = looksLikeHeader
    ? firstLineVals
    : firstLineVals.map((_, i) => `Column ${i + 1}`);
  const dataStartIndex = looksLikeHeader ? 1 : 0;
  const rows = [];
  const errors = [];
  for (let i = dataStartIndex; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    if (vals.every((v) => !v.trim())) continue;
    if (vals.length !== headers.length) {
      errors.push(`Row ${i + 1}: expected ${headers.length} columns, got ${vals.length}`);
      continue;
    }
    const row = {};
    headers.forEach((h, j) => {
      row[h] = vals[j]?.trim() ?? '';
    });
    rows.push(row);
  }
  return { headers, rows, errors, noHeaderRow };
}

/**
 * Infer column → field mapping from headers and optional value sampling.
 * @param {string[]} csvHeaders
 * @param {Record<string,string>[]} rows
 * @param {{
 *   headerToField: Record<string, string>,
 *   fieldLabels: Record<string, string>,
 *   inferFromValues?: (values: string[]) => string | null,
 *   columnMap?: { key: string, aliases: string[] }[],
 * }} config - headerToField maps lowercase header to field key; fieldLabels maps field key to display name.
 *   If columnMap is provided, it overrides headerToField (each alias + key maps to key).
 * @returns {{ csvHeader: string, field: string | null, label: string }[]}
 */
export function inferMapping(csvHeaders, rows, config) {
  const { fieldLabels = {}, inferFromValues } = config;

  let headerToField = config.headerToField || {};
  if (config.columnMap && config.columnMap.length > 0) {
    headerToField = {};
    config.columnMap.forEach(({ key, aliases }) => {
      headerToField[key.toLowerCase()] = key;
      aliases.forEach((a) => {
        headerToField[a.toLowerCase().trim()] = key;
      });
    });
  }

  const normalize = (h) => (h || '').toLowerCase().trim();

  const headerBased = csvHeaders.map((h) => {
    const key = normalize(h);
    let field = headerToField[key] ?? null;
    if (!field && key) {
      for (const [k, v] of Object.entries(headerToField)) {
        if (k.includes(key) || key.includes(k)) {
          field = v;
          break;
        }
      }
    }
    return { csvHeader: h, field, label: field ? (fieldLabels[field] || field) : null };
  });

  const usedFields = new Set(headerBased.map((m) => m.field).filter(Boolean));
  const columnValues = csvHeaders.map((h) =>
    rows.map((r) => r[h]).filter((v) => v != null && String(v).trim() !== '')
  );

  return headerBased.map((m, i) => {
    if (m.field) return { ...m, label: m.label || fieldLabels[m.field] || m.field };
    const inferred = inferFromValues ? inferFromValues(columnValues[i]) : null;
    const field = inferred && !usedFields.has(inferred) ? inferred : null;
    if (field) usedFields.add(field);
    const label = field ? (fieldLabels[field] || field) : '—';
    return { csvHeader: m.csvHeader, field, label };
  });
}

/**
 * Compute mapped rows from raw rows + headers + mapping.
 * @param {Record<string,string>[]} rows
 * @param {string[]} headers
 * @param {{ csvHeader: string, field: string | null }[]} mapping
 * @returns {Record<string,string>[]}
 */
export function computeMappedRows(rows, headers, mapping) {
  if (!rows?.length || !headers?.length || !mapping?.length) return [];
  return rows.map((row) => {
    const out = {};
    mapping.forEach((m) => {
      if (m.field && row[m.csvHeader] !== undefined) out[m.field] = row[m.csvHeader] ?? '';
    });
    return out;
  });
}
