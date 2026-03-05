'use client';

import { useState, useRef, useEffect } from 'react';
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
  Sparkles,
} from 'lucide-react';
import { auth } from '@/lib/firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ['Choose', 'Add Contacts', 'Review Targets', 'Confirm', 'Done'];

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

// CSV template (also served from /public/templates/ignite-targets-template.csv)
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

// ─── Relationship inference (client-side keyword matching) ────────────────────
// Mirrors the logic in PersonaSuggestionService but runs instantly without an API call.
// The AI can refine this after the contact is saved.

function inferRelationshipFromNotes(notes) {
  if (!notes || notes.trim().length < 6) return '';
  const t = notes.toLowerCase();

  if (/warm.?intro|intro.?from|introduced.?by|connected.?via.*intro/i.test(t)) return 'Warm intro';
  if (/referral|referred.?by|referred.?me|referred.?us/i.test(t)) return 'Referral';
  if (/former.?colleague|used.?to.?work|worked.?together|ex.?colleague|old.?colleague|previous.?colleague/i.test(t)) return 'Former colleague';
  if (/conference|summit|roundtable|meetup|forum|dinner|gala|panel|workshop|event/i.test(t)) return 'Event connection';
  if (/met.?recently|met.?last|ran.?into|bumped.?into/i.test(t)) return 'Met recently';
  if (/industry.?peer|same.?industry|same.?space|competitor|same.?sector/i.test(t)) return 'Industry peer';
  if (/prior.?conversation|spoke.?before|talked.?before|previous.?conversation|chatted.?before/i.test(t)) return 'Prior conversation';
  if (/cold|haven.?t.?met|never.?met|no.?prior|don.?t.?know/i.test(t)) return 'Cold outreach';

  return '';
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
  const looksLikeHeader = HEADER_HINTS.some((h) => lines[0].toLowerCase().includes(h));

  let headers = null;
  let dataLines = lines;
  if (looksLikeHeader) {
    headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
    dataLines = lines.slice(1);
  }

  const idx = (aliases) => headers
    ? headers.findIndex((h) => aliases.some((a) => h.includes(a)))
    : -1;

  const nameIdx = idx(['name', 'full name']);
  const companyIdx = idx(['company', 'org', 'employer']);
  const titleIdx = idx(['title', 'position', 'role', 'job']);
  const linkedinIdx = idx(['linkedin', 'url', 'profile']);
  const relationshipIdx = idx(['relationship', 'how met', 'howmet', 'context']);
  const notesIdx = idx(['notes', 'note', 'description']);

  const get = (parts, i, fallback) => {
    const ri = i !== -1 ? i : fallback;
    return ri >= 0 && ri < parts.length ? (parts[ri] || '') : '';
  };

  return dataLines
    .map((l) => parseCSVLine(l))
    .filter((p) => p.some((v) => v))
    .map((parts) => {
      const notes = get(parts, notesIdx, 4);
      const relationship = get(parts, relationshipIdx, -1) || inferRelationshipFromNotes(notes);
      return {
        name: get(parts, nameIdx, 0),
        company: get(parts, companyIdx, 1),
        title: get(parts, titleIdx, 2),
        linkedin: get(parts, linkedinIdx, 3),
        relationship,
        notes,
      };
    })
    .filter((c) => c.name);
}

function parseStructuredPaste(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines
    .filter((l) => !/^(name|full name)[\s\t,|]/i.test(l))
    .map((line) => {
      let parts;
      if (line.includes('|')) parts = line.split('|').map((p) => p.trim());
      else if (line.includes('\t')) parts = line.split('\t').map((p) => p.trim());
      else parts = line.split(',').map((p) => p.trim());
      if (!parts[0]) return null;
      const notes = parts[4] || '';
      return {
        name: parts[0] || '',
        company: parts[1] || '',
        title: parts[2] || '',
        linkedin: parts[3] || '',
        relationship: inferRelationshipFromNotes(notes),
        notes,
      };
    })
    .filter(Boolean);
}

function parseFreeformText(text) {
  const blocks = text.trim().split(/\n\s*\n/).filter(Boolean);
  return blocks.map((block) => {
    const fullText = block.split('\n').map((l) => l.trim()).join(' ').trim();

    const urlMatch = fullText.match(
      /https?:\/\/(?:www\.)?linkedin\.com\/[^\s,)>]+|https?:\/\/[^\s,)>]+/i
    );
    const linkedin = urlMatch ? urlMatch[0].replace(/[,.)>]+$/, '') : '';
    const textNoUrl = fullText.replace(urlMatch ? urlMatch[0] : '', '').trim();

    const nameMatch = textNoUrl.match(
      /^([A-Z][a-záéíóúñ'-]+(?:\s+[A-Z][a-záéíóúñ'-]+){0,2})(?:\s*[-–—,]|\s+(?:at|is|was|worked|from|now|currently|used|just|recently)\b)/
    );
    const name = nameMatch ? nameMatch[1].trim() : '';

    const companyPatterns = [
      /(?:now\s+at|moved\s+(?:on\s+)?to|joined|works?\s+at|currently\s+at|just\s+joined)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s*[.,;()\n]|$)/i,
      /\(([A-Z][A-Za-z0-9\s&.'-]+?)\)[^)]*$/i,
      /[@]\s*([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s*[.,;)\n]|$)/i,
    ];
    let company = '';
    for (const pat of companyPatterns) {
      const m = textNoUrl.match(pat);
      if (m) { company = m[1].trim(); break; }
    }

    const notes = fullText.replace(urlMatch ? urlMatch[0] : '', '').trim();
    return { name, company, title: '', linkedin, relationship: inferRelationshipFromNotes(notes), notes };
  }).filter((c) => c.name || c.notes);
}

// ─── Single Contact Card (one-at-a-time) ──────────────────────────────────────

function SingleContactCard({ contact, index, total, onChange, onDelete }) {
  const update = (field, value) => onChange(index, { ...contact, [field]: value });

  // Auto-infer relationship from notes when notes change (only if not manually set)
  const [userSetRelationship, setUserSetRelationship] = useState(!!contact.relationship);

  useEffect(() => {
    if (userSetRelationship) return;
    const inferred = inferRelationshipFromNotes(contact.notes);
    if (inferred && inferred !== contact.relationship) {
      onChange(index, { ...contact, relationship: inferred });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.notes]);

  const handleRelationshipChange = (val) => {
    setUserSetRelationship(true);
    update('relationship', val);
  };

  const inferredRelationship = !userSetRelationship && contact.notes
    ? inferRelationshipFromNotes(contact.notes)
    : null;

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Target {index + 1} of {total}
        </span>
        {total > 1 && (
          <button
            onClick={() => onDelete(index)}
            className="flex items-center gap-1 text-xs text-red-400 transition hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      {/* Per-card progress bar */}
      <div className="h-1 w-full rounded-full bg-gray-100">
        <div
          className="h-1 rounded-full bg-blue-400 transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Name *</label>
          <input
            type="text"
            value={contact.name}
            onChange={(e) => update('name', e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Company</label>
          <input
            type="text"
            value={contact.company}
            onChange={(e) => update('company', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
          <input
            type="text"
            value={contact.title}
            onChange={(e) => update('title', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Notes — full width, drives relationship inference */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
        <textarea
          value={contact.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Relationship Context — auto-filled from notes */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Relationship Context</label>
          {inferredRelationship && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              <Sparkles className="h-3 w-3" />
              Auto-detected from notes
            </span>
          )}
        </div>
        <select
          value={contact.relationship}
          onChange={(e) => handleRelationshipChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {RELATIONSHIP_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt || '— Select —'}
            </option>
          ))}
        </select>
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
  const [currentIdx, setCurrentIdx] = useState(0); // which card is shown in step 2
  const [parseError, setParseError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);

  const reset = () => {
    setStep(0);
    setMethod(null);
    setInputText('');
    setContacts([]);
    setCurrentIdx(0);
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

  const goToReview = (parsed) => {
    setContacts(parsed);
    setCurrentIdx(0);
    setParseError('');
    setStep(2);
  };

  // CSV
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCSVText(text);
    if (!parsed.length) {
      setParseError('No contacts found. Download the template to see the expected format.');
      return;
    }
    goToReview(parsed);
  };

  // Structured paste
  const handleParseStructured = () => {
    if (!inputText.trim()) { setParseError('Paste some contacts first.'); return; }
    const parsed = parseStructuredPaste(inputText);
    if (!parsed.length) {
      setParseError('Could not parse contacts. Use: Name | Company | Title | LinkedIn | Notes (one per line).');
      return;
    }
    goToReview(parsed);
  };

  // Freeform
  const handleParseFreeform = () => {
    if (!inputText.trim()) { setParseError('Write something about the person first.'); return; }
    const parsed = parseFreeformText(inputText);
    if (!parsed.length) {
      setParseError('Could not find any contacts. Start each person with their name.');
      return;
    }
    goToReview(parsed);
  };

  const handleChange = (idx, updated) => {
    setContacts((prev) => prev.map((c, i) => (i === idx ? updated : c)));
  };

  const handleDelete = (idx) => {
    const next = contacts.filter((_, i) => i !== idx);
    setContacts(next);
    setCurrentIdx(Math.min(currentIdx, Math.max(next.length - 1, 0)));
  };

  const handleAddBlank = () => {
    const next = [...contacts, { ...EMPTY_CONTACT }];
    setContacts(next);
    setCurrentIdx(next.length - 1);
  };

  const validContacts = contacts.filter((c) => c.name.trim());
  const currentContact = contacts[currentIdx] || null;
  const isLastCard = currentIdx === contacts.length - 1;
  const isFirstCard = currentIdx === 0;

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
          <button onClick={handleClose} className="rounded-lg p-2 text-gray-400 transition hover:bg-white/60 hover:text-gray-600">
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
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Choose how to add targets. Keep it to <strong>5–10 intentional people</strong> — not a bulk import.
              </p>
              <button
                onClick={() => chooseMethod('csv')}
                className="group flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-5 py-4 text-left transition hover:border-blue-400 hover:bg-blue-50"
              >
                <Upload className="h-8 w-8 flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition" />
                <div>
                  <div className="font-semibold text-gray-900">Upload CSV</div>
                  <div className="text-sm text-gray-500">Upload a spreadsheet — download the template to start</div>
                </div>
              </button>
              <button
                onClick={() => chooseMethod('paste')}
                className="group flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-5 py-4 text-left transition hover:border-blue-400 hover:bg-blue-50"
              >
                <ClipboardList className="h-8 w-8 flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition" />
                <div>
                  <div className="font-semibold text-gray-900">Paste Structured</div>
                  <div className="text-sm text-gray-500">
                    Copy rows from a spreadsheet or use{' '}
                    <span className="font-mono text-xs">Name | Company | Title | LinkedIn | Notes</span>
                  </div>
                </div>
              </button>
              <button
                onClick={() => chooseMethod('freeform')}
                className="group flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-5 py-4 text-left transition hover:border-indigo-400 hover:bg-indigo-50"
              >
                <MessageSquarePlus className="h-8 w-8 flex-shrink-0 text-gray-400 group-hover:text-indigo-500 transition" />
                <div>
                  <div className="font-semibold text-gray-900">Quick Note</div>
                  <div className="text-sm text-gray-500">
                    Just write your thoughts — "Susan Min, used to be at WeCommerce, now at PIMCO…" We'll parse what we can.
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ── Step 1: CSV ── */}
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
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
              </div>
              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{parseError}
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Structured Paste ── */}
          {step === 1 && method === 'paste' && (
            <div className="space-y-5">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                One contact per line. Separate fields with <strong>|</strong>, tab, or comma.
                <div className="font-mono text-xs mt-2 opacity-75">
                  Susan Min | PIMCO | Managing Director | https://linkedin.com/in/susanmin | Former colleague at WeCommerce
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
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{parseError}
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Freeform ── */}
          {step === 1 && method === 'freeform' && (
            <div className="space-y-5">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
                Write naturally. Separate multiple contacts with a <strong>blank line</strong>. Include a URL if you have it.
                <div className="mt-2 rounded bg-white/60 p-2 text-xs text-indigo-700 italic leading-relaxed">
                  "Susan Min — did a small project together when she was at WeCommerce, now she's moved to PIMCO. https://linkedin.com/in/susanmin"
                  <br /><br />
                  "John Rivera, met at Ignite Summit last month. Really sharp ops guy. Now at Blackstone."
                </div>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
              <p className="text-xs text-gray-400">
                Relationship context is inferred from your notes automatically. Refine it in the next step.
              </p>
              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{parseError}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: One-at-a-time review ── */}
          {step === 2 && currentContact && (
            <SingleContactCard
              key={currentIdx}
              contact={currentContact}
              index={currentIdx}
              total={contacts.length}
              onChange={handleChange}
              onDelete={handleDelete}
            />
          )}
          {step === 2 && !currentContact && (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <p className="text-gray-500 text-sm">No contacts left. Add one below.</p>
              <button onClick={handleAddBlank} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" /> Add a contact
              </button>
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Ready to save <strong>{validContacts.length} target{validContacts.length !== 1 ? 's' : ''}</strong>. Each will be queued for template generation.
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
                        {c.relationship && <span className="ml-2 font-medium text-blue-600">{c.relationship}</span>}
                      </p>
                      {c.notes && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">{c.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{parseError}
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

        {/* ── Footer ── */}
        {step < 4 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 flex-shrink-0">
            {/* Left: Back */}
            <div>
              {step > 0 && !(step === 2 && !isFirstCard) && (
                <button
                  onClick={() => { setParseError(''); if (step === 2) { setCurrentIdx(0); setStep(1); } else setStep((s) => s - 1); }}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              {/* In step 2, prev card */}
              {step === 2 && !isFirstCard && (
                <button
                  onClick={() => setCurrentIdx((i) => i - 1)}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-3">
              <button onClick={handleClose} className="text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>

              {/* Step 1 structured */}
              {step === 1 && method === 'paste' && (
                <button onClick={handleParseStructured} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                  Parse Contacts <ChevronRight className="h-4 w-4" />
                </button>
              )}

              {/* Step 1 freeform */}
              {step === 1 && method === 'freeform' && (
                <button onClick={handleParseFreeform} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">
                  Extract contacts <ChevronRight className="h-4 w-4" />
                </button>
              )}

              {/* Step 2: next card OR advance to confirm */}
              {step === 2 && currentContact && !isLastCard && (
                <button
                  disabled={!currentContact.name?.trim()}
                  onClick={() => setCurrentIdx((i) => i + 1)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next contact <ChevronRight className="h-4 w-4" />
                </button>
              )}
              {step === 2 && currentContact && isLastCard && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddBlank}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                  <button
                    disabled={!validContacts.length}
                    onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review {validContacts.length} <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Step 3: save */}
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
            <button onClick={reset} className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              Submit more
            </button>
            <button onClick={handleClose} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
