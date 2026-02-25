'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, User, X, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import { auth } from '@/lib/firebase';

// Known header phrases: if the first line has any of these (lowercased), we treat it as a header row
const HEADER_ROW_HINTS = new Set([
  'first name', 'last name', 'firstname', 'lastname', 'first', 'last', 'fname', 'lname',
  'given name', 'family name', 'surname', 'email', 'email address', 'company', 'company name',
  'companyname', 'organization', 'org', 'title', 'job title', 'jobtitle', 'position', 'role',
  'url', 'linkedin', 'linkedin url', 'linkedinurl', 'profile url', 'profileurl', 'profile',
  'connected on', 'connectedon', 'date connected', 'phone', 'phone number', 'phonenumber', 'mobile',
  'notes', 'note', 'description', 'pipeline', 'stage',
]);

// Client-side CSV parse: preserve original header casing, strip BOM. If first line doesn't look like headers, treat it as data and use Column 1, Column 2, ...
function parseCSVClient(csvText) {
  const normalized = (typeof csvText === 'string' ? csvText : '').replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [], errors: [] };
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
  const looksLikeHeader = firstLineLower.some((cell) => cell && HEADER_ROW_HINTS.has(cell));
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

// Same as batch API: CSV header (any case) → our field key
const HEADER_TO_FIELD = {
  'first name': 'firstName',
  firstname: 'firstName',
  first: 'firstName',
  fname: 'firstName',
  'given name': 'firstName',
  givenname: 'firstName',
  'last name': 'lastName',
  lastname: 'lastName',
  last: 'lastName',
  lname: 'lastName',
  'family name': 'lastName',
  surname: 'lastName',
  email: 'email',
  'email address': 'email',
  'company name': 'companyName',
  companyname: 'companyName',
  company: 'companyName',
  organization: 'companyName',
  org: 'companyName',
  title: 'title',
  'job title': 'title',
  jobtitle: 'title',
  position: 'title',
  role: 'title',
  url: 'linkedinUrl',
  linkedin: 'linkedinUrl',
  'linkedin url': 'linkedinUrl',
  linkedinurl: 'linkedinUrl',
  'profile url': 'linkedinUrl',
  profileurl: 'linkedinUrl',
  'profile': 'linkedinUrl',
  'connected on': 'linkedinConnectedOn',
  connectedon: 'linkedinConnectedOn',
  'date connected': 'linkedinConnectedOn',
  phone: 'phone',
  'phone number': 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  notes: 'notes',
  note: 'notes',
  description: 'notes',
  pipeline: 'pipeline',
  stage: 'stage',
};

const FIELD_LABELS = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email Address',
  companyName: 'Company',
  title: 'Position / Title',
  linkedinUrl: 'URL (LinkedIn)',
  linkedinConnectedOn: 'Connected On',
  phone: 'Phone',
  notes: 'Notes',
  pipeline: 'Pipeline',
  stage: 'Stage',
};


// Infer field from header name only
function inferFieldFromHeader(header) {
  const key = (header || '').toLowerCase().trim();
  return HEADER_TO_FIELD[key] || null;
}

// Infer field from sample values (first N rows of this column)
function inferFieldFromValues(values) {
  if (!values?.length) return null;
  const joined = values.slice(0, 10).join(' ').trim();
  const first = (values[0] || '').trim();
  if (!first) return null;
  // LinkedIn or profile URL
  if (/linkedin\.com|profile.*url|^https?:\/\//i.test(first) || /linkedin\.com/i.test(joined)) return 'linkedinUrl';
  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(first)) return 'email';
  // Date (e.g. "22 Feb 2024", "2024-02-22", "Feb 22, 2024")
  if (/^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}$/i.test(first) ||
      /^\d{4}-\d{2}-\d{2}$/.test(first) ||
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}$/i.test(first)) return 'linkedinConnectedOn';
  // Long text → notes
  if (first.length > 80 || (first.includes('.') && first.split(/[.!?]/).length >= 2)) return 'notes';
  // Job title keywords (position/title)
  if (/\b(VP|Vice President|Director|Manager|Counsel|General Counsel|Chief|CEO|CFO|COO|President|Partner|Associate|Analyst|Engineer|Lead|Head of)\b/i.test(first) ||
      /\b(Deputy|Senior|Junior|Principal|Staff)\s+\w+/i.test(first)) return 'title';
  // Multi-word or longer string, no @, no URL → likely company name
  const wordCount = first.split(/\s+/).length;
  if (!first.includes('@') && !/^https?:\/\//i.test(first) && first.length > 10 && first.length < 80 && wordCount >= 2 && wordCount <= 5) return 'companyName';
  return null;
}

// Build full mapping: prefer header match, then infer from column values for unmapped columns
function inferMapping(csvHeaders, rows) {
  const headerBased = csvHeaders.map((h) => {
    const field = inferFieldFromHeader(h);
    return { csvHeader: h, field, label: field ? FIELD_LABELS[field] || field : null };
  });
  const usedFields = new Set(headerBased.map((m) => m.field).filter(Boolean));
  const columnValues = csvHeaders.map((h) => rows.map((r) => r[h]).filter((v) => v != null && String(v).trim() !== ''));
  return headerBased.map((m, i) => {
    if (m.field) return { ...m, label: m.label || FIELD_LABELS[m.field] || m.field };
    const inferred = inferFieldFromValues(columnValues[i]);
    const field = inferred && !usedFields.has(inferred) ? inferred : null;
    if (field) usedFields.add(field);
    const label = field ? FIELD_LABELS[field] || field : '—';
    return { csvHeader: m.csvHeader, field, label };
  });
}

const FIELD_ORDER = ['firstName', 'lastName', 'email', 'companyName', 'title', 'linkedinUrl', 'linkedinConnectedOn', 'phone', 'notes', 'pipeline', 'stage'];
const FIELD_TO_CANONICAL_HEADER = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email Address',
  companyName: 'Company',
  title: 'Position',
  linkedinUrl: 'URL',
  linkedinConnectedOn: 'Connected On',
  phone: 'Phone',
  notes: 'Notes',
  pipeline: 'Pipeline',
  stage: 'Stage',
};

function buildCSVFromMappedRows(mappedRows) {
  const headerLine = FIELD_ORDER.map((f) => FIELD_TO_CANONICAL_HEADER[f]).join(',');
  const escape = (v) => {
    if (v == null || v === '') return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headerLine];
  mappedRows.forEach((row) => {
    const vals = FIELD_ORDER.map((f) => row[f] ?? '');
    lines.push(vals.map(escape).join(','));
  });
  return lines.join('\n');
}

// Recompute mapped rows from parsed data + mapping (single source of truth for save)
function computeMappedRows(rows, headers, mapping) {
  if (!rows?.length || !headers?.length || !mapping?.length) return [];
  return rows.map((row) => {
    const out = {};
    mapping.forEach((m) => {
      if (m.field && row[m.csvHeader] !== undefined) out[m.field] = row[m.csvHeader] ?? '';
    });
    return out;
  });
}

const STEPS = ['View', 'Confirm mapping', 'Edit data', 'Looks good — Save', 'Success'];

export default function ContactUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState({ headers: [], rows: [], errors: [] });
  const [step, setStep] = useState(0);
  const [mapping, setMapping] = useState([]);
  const [mappedRows, setMappedRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [successResult, setSuccessResult] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFileSelect = async (event) => {
    const f = event.target.files?.[0];
    if (!f) return;
    if (f.type !== 'text/csv' && !f.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file.');
      return;
    }
    setFile(f);
    const text = await f.text();
    setCsvText(text);
    const result = parseCSVClient(text);
    setParsed(result);
    const inferred = inferMapping(result.headers, result.rows);
    setMapping(inferred);
    const mapped = result.rows.map((row) => {
      const out = {};
      result.headers.forEach((csvH, i) => {
        const m = inferred[i];
        if (m?.field) out[m.field] = row[csvH] ?? '';
      });
      return out;
    });
    setMappedRows(mapped);
    setStep(0);
    setSuccessResult(null);
  };

  useEffect(() => {
    if (step >= 1 && mapping.length > 0 && parsed.rows.length > 0) {
      const mapped = parsed.rows.map((row) => {
        const out = {};
        mapping.forEach((m) => {
          if (m.field && row[m.csvHeader] !== undefined) out[m.field] = row[m.csvHeader] ?? '';
        });
        return out;
      });
      setMappedRows(mapped);
    }
  }, [step, mapping, parsed.rows]);

  const handleCellEdit = (rowIndex, field, value) => {
    setMappedRows((prev) => {
      const next = [...prev];
      if (!next[rowIndex]) return prev;
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  };

  // When leaving preview (step 0), sync mappedRows from parsed data so we never lose rows
  const goToNextStep = () => {
    if (step === 0 && parsed.rows.length > 0 && mapping.length > 0) {
      const nextMapped = computeMappedRows(parsed.rows, parsed.headers, mapping);
      setMappedRows(nextMapped);
    }
    setStep((s) => s + 1);
  };

  const handleSave = async () => {
    const companyHQId = typeof window !== 'undefined' ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId')) : null;
    if (!companyHQId) {
      alert('Company context required. Please set your company first.');
      router.push('/company/create-or-choose');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      alert('Please sign in to upload contacts.');
      return;
    }
    // Use in-memory rows (with edits) when we have them; otherwise recompute from parsed + mapping so we don't send 0 rows by mistake
    const rowsToSave = mappedRows.length > 0
      ? mappedRows
      : computeMappedRows(parsed.rows, parsed.headers, mapping);
    if (rowsToSave.length === 0) {
      alert('No contact data to save. If you had rows in the preview, go back to "Confirm mapping" and click Next again, then try saving.');
      return;
    }
    setUploading(true);
    try {
      const token = await user.getIdToken();
      const csv = buildCSVFromMappedRows(rowsToSave);
      const blob = new Blob([csv], { type: 'text/csv' });
      const uploadFile = new File([blob], file?.name || 'contacts.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('companyHQId', companyHQId);
      const response = await fetch('/api/contacts/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Upload failed');
      setSuccessResult(result);
      setStep(4);
      try {
        const refreshResponse = await fetch(`/api/contacts/retrieve?companyHQId=${companyHQId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.success && refreshData.contacts) {
            window.localStorage.setItem('contacts', JSON.stringify(refreshData.contacts));
          }
        }
      } catch (_) {}
    } catch (err) {
      console.error(err);
      alert(`Upload failed: ${err.message || 'Please try again.'}`);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    if (typeof window === 'undefined') return;
    const template = FIELD_ORDER.map((f) => FIELD_TO_CANONICAL_HEADER[f]).join(',') + '\n';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contacts_upload_template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-2xl font-bold text-gray-900">Loading...</div>
          <div className="text-gray-600">Preparing contact upload</div>
        </div>
      </div>
    );
  }

  const noFile = !file || !csvText;
  const stepTitles = STEPS;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Upload Contacts"
          subtitle="Upload a CSV to add people to your Ignite workspace"
          backTo={step === 0 && noFile ? '/people/load' : undefined}
          backLabel={step === 0 && noFile ? 'Back to Load Up' : step > 0 ? 'Back' : undefined}
        />

        <div className="mb-8">
          <button
            onClick={() => router.push('/contacts/manual')}
            className="group w-full rounded-xl border-2 border-blue-200 p-6 text-left transition hover:border-blue-400 hover:bg-blue-50"
            type="button"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-100 transition group-hover:bg-blue-500">
                <User className="h-8 w-8 text-blue-600 transition group-hover:text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">Add Manually</h3>
                <p className="text-sm text-gray-600">Enter single contacts without using a CSV import.</p>
              </div>
              <ChevronRight className="h-6 w-6 text-gray-400 group-hover:text-blue-600" />
            </div>
          </button>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Upload CSV</h2>
              <p className="text-gray-600">
                Required: First Name, Last Name. Optional: URL, Email, Company, Position, Connected On, Notes, Pipeline, Stage.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              Download CSV Template
            </button>
          </div>

          {noFile ? (
            <>
              <div className="mb-6 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400">
                <Upload className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                <p className="mb-2 text-gray-600">Click to upload or drag and drop</p>
                <p className="mb-4 text-xs text-gray-500">CSV files only</p>
                <label className="inline-block cursor-pointer rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
                  <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
                  Select CSV File
                </label>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <strong>Batch processing:</strong> You’ll get to view rows, confirm column mapping, edit data, then save.
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-700">Step {step + 1} of 5:</span>
                <span className="text-sm text-gray-600">{stepTitles[step]}</span>
                <span className="text-xs text-gray-500">({file.name}, {parsed.rows.length} rows)</span>
              </div>

              {step === 0 && (
                <>
                  <p className="mb-2 text-gray-600">Preview: first rows from your file.</p>
                  {parsed.noHeaderRow && (
                    <p className="mb-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                      No header row detected — your first line was used as data. Columns are named Column 1, Column 2, … and will be inferred from content on the next step.
                    </p>
                  )}
                  <div className="overflow-x-auto border rounded-lg max-h-80 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          {parsed.headers.map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, 20).map((row, i) => (
                          <tr key={i} className="border-t border-gray-200 hover:bg-gray-50">
                            {parsed.headers.map((h) => (
                              <td key={h} className="px-3 py-2 text-gray-800 max-w-xs truncate" title={row[h]}>
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.rows.length > 20 && (
                    <p className="mt-2 text-sm text-gray-500">Showing first 20 of {parsed.rows.length} rows.</p>
                  )}
                  {parsed.errors.length > 0 && (
                    <div className="mt-2 text-amber-700 text-sm">
                      Warnings: {parsed.errors.slice(0, 3).join('; ')}
                      {parsed.errors.length > 3 && ` (+${parsed.errors.length - 3} more)`}
                    </div>
                  )}
                </>
              )}

              {step === 1 && (
                <>
                  {parsed.rows.length === 0 && (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      This file has no data rows—only headers. You can still confirm mapping for future uploads, but there will be nothing to edit or save until you use a CSV with at least one row of data.
                    </div>
                  )}
                  <p className="mb-3 text-gray-600">Confirm how your columns map to contact fields. Change any dropdown if needed.</p>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">CSV column</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Maps to</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mapping.map((m, i) => (
                          <tr key={i} className="border-t border-gray-200">
                            <td className="px-3 py-2 text-gray-800 font-medium">{m.csvHeader}</td>
                            <td className="px-3 py-2">
                              <select
                                value={m.field || ''}
                                onChange={(e) => {
                                  const v = e.target.value || null;
                                  setMapping((prev) => {
                                    const next = [...prev];
                                    next[i] = { ...next[i], field: v, label: v ? (FIELD_LABELS[v] || v) : '—' };
                                    return next;
                                  });
                                }}
                                className="rounded border border-gray-300 px-2 py-1 text-gray-800"
                              >
                                <option value="">— Don’t import</option>
                                {Object.entries(FIELD_LABELS).map(([k, label]) => (
                                  <option key={k} value={k}>{label}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  {mappedRows.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
                      <p className="font-semibold text-amber-800">No data rows in this file</p>
                      <p className="mt-2 text-sm text-amber-700">
                        Your CSV has column headers but no data rows, or all rows were empty. There’s nothing to edit or save.
                      </p>
                      <p className="mt-2 text-sm text-amber-700">
                        Use <strong>Back</strong> to check the mapping, or <strong>Start over</strong> to upload a different file (one that has at least one row of contact data).
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="mb-3 text-gray-600">Edit any cell below, then click “Looks good — Save”.</p>
                      <div className="overflow-x-auto border rounded-lg max-h-96 overflow-y-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-8">#</th>
                              {Object.keys(FIELD_LABELS).filter((f) => mapping.some((m) => m.field === f)).map((field) => (
                                <th key={field} className="px-2 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                                  {FIELD_LABELS[field]}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {mappedRows.map((row, ri) => (
                              <tr key={ri} className="border-t border-gray-200 hover:bg-gray-50">
                                <td className="px-2 py-1 text-gray-500">{ri + 1}</td>
                                {Object.keys(FIELD_LABELS)
                                  .filter((f) => mapping.some((m) => m.field === f))
                                  .map((field) => (
                                    <td key={field} className="px-2 py-1">
                                      <input
                                        type="text"
                                        value={row[field] ?? ''}
                                        onChange={(e) => handleCellEdit(ri, field, e.target.value)}
                                        className="w-full min-w-[8rem] rounded border border-gray-300 px-2 py-1 text-gray-800 text-sm"
                                      />
                                    </td>
                                  ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  {mappedRows.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
                      <p className="font-semibold text-amber-800">No contacts to save</p>
                      <p className="mt-2 text-sm text-amber-700">
                        This file has no data rows. Use <strong>Back</strong> or <strong>Start over</strong> to upload a CSV with at least one row of contact data.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="mb-3 text-gray-600">Ready to save {mappedRows.length} contacts. Click below to upload.</p>
                      <div className="overflow-x-auto border rounded-lg max-h-64 overflow-y-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-8">#</th>
                              {Object.keys(FIELD_LABELS).filter((f) => mapping.some((m) => m.field === f)).map((field) => (
                                <th key={field} className="px-2 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                                  {FIELD_LABELS[field]}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {mappedRows.slice(0, 10).map((row, ri) => (
                              <tr key={ri} className="border-t border-gray-200">
                                <td className="px-2 py-1 text-gray-500">{ri + 1}</td>
                                {Object.keys(FIELD_LABELS)
                                  .filter((f) => mapping.some((m) => m.field === f))
                                  .map((field) => (
                                    <td key={field} className="px-2 py-1 text-gray-800 max-w-xs truncate">
                                      {row[field] ?? ''}
                                    </td>
                                  ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {mappedRows.length > 10 && (
                        <p className="mt-2 text-sm text-gray-500">Showing first 10 of {mappedRows.length} rows.</p>
                      )}
                    </>
                  )}
                </>
              )}

              {step === 4 && successResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
                  <p className="text-lg font-semibold text-green-800">
                    Processed {successResult.total ?? 0} rows: {successResult.created ?? 0} created, {successResult.updated ?? 0} updated.
                  </p>
                  {successResult.errors?.length > 0 && (
                    <p className="mt-2 text-sm text-amber-700">
                      Some rows had issues: {successResult.errors.slice(0, 3).join('; ')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push('/people')}
                    className="mt-4 rounded-lg bg-green-600 px-6 py-2 font-semibold text-white hover:bg-green-700"
                  >
                    View contacts
                  </button>
                </div>
              )}

              <div className="mt-8 flex items-center gap-3 flex-wrap">
                {step < 4 && (
                  <>
                    {step > 0 && (
                      <button
                        type="button"
                        onClick={() => setStep((s) => s - 1)}
                        className="rounded-lg bg-gray-100 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-200"
                      >
                        Back
                      </button>
                    )}
                    {step < 3 && (
                      <button
                        type="button"
                        onClick={goToNextStep}
                        className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                      >
                        Next: {stepTitles[step + 1]}
                      </button>
                    )}
                    {step === 3 && (
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={uploading || mappedRows.length === 0}
                        className="rounded-lg bg-green-600 px-6 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {uploading ? 'Saving…' : mappedRows.length === 0 ? 'No contacts to save' : 'Yes, save these contacts'}
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setCsvText('');
                    setParsed({ headers: [], rows: [], errors: [] });
                    setStep(0);
                    setMapping([]);
                    setMappedRows([]);
                    setSuccessResult(null);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Start over
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
