'use client';

import { useState, useRef } from 'react';
import {
  X,
  Upload,
  ClipboardList,
  MessageSquarePlus,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Download,
} from 'lucide-react';
import { auth } from '@/lib/firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ['Choose', 'Add Contacts', 'Preview & Edit', 'Confirm', 'Done'];

const RELATIONSHIP_OPTIONS = [
  '',
  'Warm intro',
  'Met recently',
  'Industry peer',
  'Cold outreach',
  'Prior conversation',
  'Event connection',
  'Former colleague',
  'Referral',
  'Other',
];

const EMPTY_CONTACT = {
  name: '',
  company: '',
  title: '',
  linkedin: '',
  relationship: '',
  notes: '',
};

// CSV template content (static — matches what the parser expects)
const CSV_TEMPLATE = `Name,Company,Title,LinkedIn URL,Relationship Context,Notes
Susan Min,PIMCO,Managing Director,https://linkedin.com/in/susanmin,Former colleague,Did a small project together at WeCommerce — she's moved to a much bigger role now
John Rivera,Blackstone,VP of Operations,https://linkedin.com/in/johnrivera,Warm intro,Intro from Sarah at Ignite Summit last month
`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ignite-targets-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCSVText(text) {
  const normalized = text.replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];

  const HEADER_HINTS = ['name', 'company', 'title', 'linkedin', 'notes', 'relationship'];
  const firstLineLower = lines[0].toLowerCase();
  const looksLikeHeader = HEADER_HINTS.some((h) => firstLineLower.includes(h));

  let headers = null;
  let dataLines = lines;

  if (looksLikeHeader) {
    headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
    dataLines = lines.slice(1);
  }

  const idx = (aliases) => {
    if (!headers) return -1;
    return headers.findIndex((h) => aliases.some((a) => h.includes(a)));
  };

  const nameIdx = idx(['name', 'full name']);
  const companyIdx = idx(['company', 'org', 'employer']);
  const titleIdx = idx(['title', 'position', 'role', 'job']);
  const linkedinIdx = idx(['linkedin', 'url', 'profile']);
  const relationshipIdx = idx(['relationship', 'how met', 'howmet', 'context']);
  const notesIdx = idx(['notes', 'note', 'description']);

  const get = (parts, i, fallbackPos) => {
    const resolvedIdx = i !== -1 ? i : fallbackPos;
    return resolvedIdx >= 0 && resolvedIdx < parts.length ? (parts[resolvedIdx] || '') : '';
  };

  return dataLines
    .map((line) => parseCSVLine(line))
    .filter((parts) => parts.some((p) => p))
    .map((parts) => ({
      name: get(parts, nameIdx, 0),
      company: get(parts, companyIdx, 1),
      title: get(parts, titleIdx, 2),
      linkedin: get(parts, linkedinIdx, 3),
      relationship: get(parts, relationshipIdx, -1),
      notes: get(parts, notesIdx, 4),
    }))
    .filter((c) => c.name);
}

// Structured paste: pipe | tab | comma per line
function parseStructuredPaste(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results = [];
  for (const line of lines) {
    if (/^(name|full name)[\s\t,|]/i.test(line)) continue;
    let parts;
    if (line.includes('|')) parts = line.split('|').map((p) => p.trim());
    else if (line.includes('\t')) parts = line.split('\t').map((p) => p.trim());
    else parts = line.split(',').map((p) => p.trim());
    if (!parts[0]) continue;
    results.push({
      name: parts[0] || '',
      company: parts[1] || '',
      title: parts[2] || '',
      linkedin: parts[3] || '',
      relationship: '',
      notes: parts[4] || '',
    });
  }
  return results;
}

// Freeform parser: extract what we can from natural language, dump the rest in notes
function parseFreeformText(text) {
  // Split into blocks by blank lines — each block = one person
  const blocks = text.trim().split(/\n\s*\n/).filter(Boolean);

  return blocks.map((block) => {
    const fullText = block.split('\n').map((l) => l.trim()).join(' ').trim();

    // 1. Extract any URL (LinkedIn or generic https://)
    const urlMatch = fullText.match(
      /https?:\/\/(?:www\.)?linkedin\.com\/[^\s,)>]+|https?:\/\/[^\s,)>]+/i
    );
    const linkedin = urlMatch ? urlMatch[0].replace(/[,.)>]+$/, '') : '';
    const textNoUrl = fullText.replace(urlMatch ? urlMatch[0] : '', '').trim();

    // 2. Extract name — first 1–3 capitalized words before a dash, comma, em-dash, or "at"
    const nameMatch = textNoUrl.match(
      /^([A-Z][a-záéíóúñ'-]+(?:\s+[A-Z][a-záéíóúñ'-]+){0,2})(?:\s*[-–—,]|\s+(?:at|is|was|worked|from|now|currently|used|just|recently)\b)/
    );
    const name = nameMatch ? nameMatch[1].trim() : '';

    // 3. Extract company — "now at X", "moved to X", "at X", "joined X", "(X)", "@ X"
    const companyPatterns = [
      /(?:now\s+at|moved\s+(?:on\s+)?to|joined|works?\s+at|currently\s+at|just\s+joined)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s*[.,;()\n]|$)/i,
      /\(([A-Z][A-Za-z0-9\s&.'-]+?)\)[^)]*$/i, // last parenthetical — often the current company
      /[@]\s*([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s*[.,;)\n]|$)/i,
    ];
    let company = '';
    for (const pat of companyPatterns) {
      const m = textNoUrl.match(pat);
      if (m) { company = m[1].trim(); break; }
    }

    // 4. Everything that isn't the name becomes notes (preserve full context)
    const notes = fullText.replace(urlMatch ? urlMatch[0] : '', '').trim();

    return { name, company, title: '', linkedin, relationship: '', notes };
  }).filter((c) => c.name || c.notes);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ContactCard({ contact, index, onChange, onDelete }) {
  const update = (field, value) => onChange(index, { ...contact, [field]: value });

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <button
        onClick={() => onDelete(index)}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
        title="Remove"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Target {index + 1}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Name *</label>
          <input
            type="text"
            value={contact.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Company</label>
          <input
            type="text"
            value={contact.company}
            onChange={(e) => update('company', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
          <input
            type="text"
            value={contact.title}
            onChange={(e) => update('title', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            LinkedIn URL
            <span className="ml-1 font-normal text-gray-400">(paste full URL)</span>
          </label>
          <input
            type="text"
            value={contact.linkedin}
            onChange={(e) => update('linkedin', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Relationship Context</label>
          <select
            value={contact.relationship}
            onChange={(e) => update('relationship', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {RELATIONSHIP_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt || '— Select —'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
          <input
            type="text"
            value={contact.notes}
            onChange={(e) => update('notes', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function TargetSubmissionModal({ isOpen, onClose, onSuccess, companyHQId }) {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState(null); // 'csv' | 'paste' | 'freeform'
  const [inputText, setInputText] = useState('');
  const [contacts, setContacts] = useState([]);
  const [parseError, setParseError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);

  const reset = () => {
    setStep(0);
    setMethod(null);
    setInputText('');
    setContacts([]);
    setParseError('');
    setSaving(false);
    setResult(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const chooseMethod = (m) => {
    setMethod(m);
    setStep(1);
    setParseError('');
  };

  // CSV file upload
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCSVText(text);
    if (!parsed.length) {
      setParseError('No contacts found. Download the template to see the expected format.');
      return;
    }
    setContacts(parsed);
    setParseError('');
    setStep(2);
  };

  // Structured paste parse
  const handleParseStructured = () => {
    if (!inputText.trim()) { setParseError('Paste some contacts first.'); return; }
    const parsed = parseStructuredPaste(inputText);
    if (!parsed.length) {
      setParseError('Could not parse contacts. Use: Name | Company | Title | LinkedIn | Notes (one per line).');
      return;
    }
    setContacts(parsed);
    setParseError('');
    setStep(2);
  };

  // Freeform parse
  const handleParseFreeform = () => {
    if (!inputText.trim()) { setParseError('Write something about the person first.'); return; }
    const parsed = parseFreeformText(inputText);
    if (!parsed.length) {
      setParseError('Could not find any contacts. Make sure each person starts with their name.');
      return;
    }
    setContacts(parsed);
    setParseError('');
    setStep(2);
  };

  const handleChange = (idx, updated) => {
    setContacts((prev) => prev.map((c, i) => (i === idx ? updated : c)));
  };
  const handleDelete = (idx) => {
    setContacts((prev) => prev.filter((_, i) => i !== idx));
  };
  const handleAddBlank = () => {
    setContacts((prev) => [...prev, { ...EMPTY_CONTACT }]);
  };

  const validContacts = contacts.filter((c) => c.name.trim());

  const handleSave = async () => {
    if (!validContacts.length) return;
    const user = auth.currentUser;
    if (!user) { setParseError('Please sign in first.'); return; }
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/targeting/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyHQId, contacts: validContacts }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      setResult(data);
      setStep(4);
      onSuccess?.();
    } catch (err) {
      setParseError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 rounded-t-2xl flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Submit Targets</h2>
            <p className="text-sm text-gray-500">
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/60 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex h-1 w-full bg-gray-100 flex-shrink-0">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── Step 0: Choose ── */}
          {step === 0 && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                Choose how to add targets. Keep it to <strong>5–10 intentional people</strong> — this is not a bulk import.
              </p>

              {/* Option 1: CSV */}
              <button
                onClick={() => chooseMethod('csv')}
                className="group flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-5 py-4 text-left transition hover:border-blue-400 hover:bg-blue-50"
              >
                <Upload className="h-8 w-8 flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition" />
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900">Upload CSV</div>
                  <div className="text-sm text-gray-500">Upload a spreadsheet — download the template to get started</div>
                </div>
              </button>

              {/* Option 2: Structured paste */}
              <button
                onClick={() => chooseMethod('paste')}
                className="group flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-5 py-4 text-left transition hover:border-blue-400 hover:bg-blue-50"
              >
                <ClipboardList className="h-8 w-8 flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition" />
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900">Paste Structured</div>
                  <div className="text-sm text-gray-500">
                    Copy rows from a spreadsheet or paste pipe-separated:{' '}
                    <span className="font-mono text-xs">Name | Company | Title | LinkedIn | Notes</span>
                  </div>
                </div>
              </button>

              {/* Option 3: Freeform */}
              <button
                onClick={() => chooseMethod('freeform')}
                className="group flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-5 py-4 text-left transition hover:border-indigo-400 hover:bg-indigo-50"
              >
                <MessageSquarePlus className="h-8 w-8 flex-shrink-0 text-gray-400 group-hover:text-indigo-500 transition" />
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900">Quick Note</div>
                  <div className="text-sm text-gray-500">
                    Just write your thoughts — "Susan Min, used to be at WeCommerce, now at PIMCO…" We'll parse out what we can.
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ── Step 1: CSV Upload ── */}
          {step === 1 && method === 'csv' && (
            <div className="space-y-5">
              <div className="flex items-start justify-between rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  Expected columns: <strong>Name, Company, Title, LinkedIn URL, Relationship Context, Notes</strong>
                </p>
                <button
                  onClick={downloadTemplate}
                  className="ml-4 flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Template
                </button>
              </div>
              <div
                className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-10 cursor-pointer transition hover:border-blue-400 hover:bg-blue-50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-gray-400" />
                <div className="text-center">
                  <p className="font-semibold text-gray-700">Click to select a CSV file</p>
                  <p className="text-sm text-gray-500 mt-1">or drag and drop</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Structured Paste ── */}
          {step === 1 && method === 'paste' && (
            <div className="space-y-5">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                One contact per line. Separate fields with <strong>|</strong> (pipe), tab, or comma.
                <div className="font-mono text-xs mt-2 opacity-75">
                  Susan Min | PIMCO | Managing Director | https://linkedin.com/in/susanmin | Former colleague
                </div>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Freeform ── */}
          {step === 1 && method === 'freeform' && (
            <div className="space-y-5">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
                Write naturally about each person. Separate multiple contacts with a <strong>blank line</strong>. Include a LinkedIn URL if you have it.
                <div className="mt-2 rounded bg-white/60 p-2 text-xs text-indigo-700 italic leading-relaxed">
                  "Susan Min — did a small project together when she was at WeCommerce, now she's moved to PIMCO. https://linkedin.com/in/susanmin"
                  <br /><br />
                  "John Rivera, met at Ignite Summit last month. Really sharp ops guy. Intro from Sarah. Now at Blackstone."
                </div>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
              <p className="text-xs text-gray-400">
                We'll extract the name, company, and any URL. Everything else lands in Notes so nothing is lost.
              </p>
              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Preview & Edit ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Review and edit. Relationship context drives the outreach template.
                </p>
                <span className="text-sm font-medium text-gray-500">
                  {validContacts.length} contact{validContacts.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-3">
                {contacts.map((c, i) => (
                  <ContactCard
                    key={i}
                    contact={c}
                    index={i}
                    onChange={handleChange}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
              <button
                onClick={handleAddBlank}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 transition hover:border-blue-400 hover:text-blue-600"
              >
                <Plus className="h-4 w-4" />
                Add another contact
              </button>
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Ready to save <strong>{validContacts.length} target{validContacts.length !== 1 ? 's' : ''}</strong>.
                Each will be queued for outreach template generation.
              </div>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
                {validContacts.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {[c.title, c.company].filter(Boolean).join(' · ')}
                        {c.relationship && (
                          <span className="ml-2 font-medium text-blue-600">{c.relationship}</span>
                        )}
                      </p>
                      {c.notes && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">{c.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 4 && result && (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-9 w-9 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Targets Submitted</h3>
                <p className="text-gray-500 mt-1">{result.created} new · {result.updated} updated</p>
              </div>
              <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-4 text-sm text-green-800 w-full max-w-sm">
                {result.message}
                {result.errors?.length > 0 && (
                  <p className="mt-2 text-amber-700 font-medium">
                    {result.errors.length} contact{result.errors.length !== 1 ? 's' : ''} had errors
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 4 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 flex-shrink-0">
            <div>
              {step > 0 && (
                <button
                  onClick={() => { setParseError(''); setStep((s) => s - 1); }}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleClose} className="text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>

              {step === 1 && method === 'paste' && (
                <button
                  onClick={handleParseStructured}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Parse Contacts
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              {step === 1 && method === 'freeform' && (
                <button
                  onClick={handleParseFreeform}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Extract contacts
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              {step === 2 && (
                <button
                  disabled={!validContacts.length}
                  onClick={() => setStep(3)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review {validContacts.length} target{validContacts.length !== 1 ? 's' : ''}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              {step === 3 && (
                <button
                  disabled={saving || !validContacts.length}
                  onClick={handleSave}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving…' : `Save ${validContacts.length} target${validContacts.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex justify-center border-t border-gray-200 px-6 py-4 flex-shrink-0 gap-3">
            <button
              onClick={reset}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Submit more
            </button>
            <button
              onClick={handleClose}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
