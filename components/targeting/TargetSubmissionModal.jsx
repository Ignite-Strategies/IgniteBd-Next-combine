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

const STEPS = ['Choose', 'Add Contacts', 'Review Targets', 'Confirm', 'Done', 'Outreach'];

// ─── Template hydration ────────────────────────────────────────────────────────
// Fills {{variable}} slots with real contact data so the template is ready to copy.
function hydrateTemplate(text, contact) {
  if (!text) return '';
  const firstName = contact.firstName || contact.fullName?.split(' ')[0] || '';
  const lastName = contact.lastName || contact.fullName?.split(' ').slice(1).join(' ') || '';
  return text
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{last_name\}\}/gi, lastName)
    .replace(/\{\{full_name\}\}/gi, contact.fullName || [firstName, lastName].filter(Boolean).join(' '))
    .replace(/\{\{company_name\}\}/gi, contact.companyName || '')
    .replace(/\{\{title\}\}/gi, contact.title || '');
}

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
  lastContact: '',
  awareOfBusiness: '',   // 'y' | 'n' | ''
  usingCompetitor: '',   // 'y' | 'n' | ''
  workedTogetherAt: '',  // company name string
  priorEngagement: '',   // 'y' | 'n' | ''
};

// Human-readable headers only — never db column names. Parser uses COLUMN_MAP to normalize.
const CSV_HEADERS = [
  'Name',
  'Company',
  'Title',
  'LinkedIn',
  'Last contact',
  'Knows your business?',
  'Using competitor?',
  'Worked together at',
  'Prior work together?',
  'Additional Context',
];
const CSV_TEMPLATE = CSV_HEADERS.join(',') + '\nJane Doe,Acme Corp,,,,,,,,\n';

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

// Maps human-readable header variants → internal field key. Used to normalize arbitrary CSV columns.
const COLUMN_MAP = [
  { key: 'name',           aliases: ['name', 'full name', 'contact name', 'person'] },
  { key: 'company',        aliases: ['company', 'org', 'employer', 'organization'] },
  { key: 'title',          aliases: ['title', 'position', 'role', 'job', 'job title'] },
  { key: 'linkedin',       aliases: ['linkedin', 'linkedin url', 'url', 'profile', 'linkedin profile'] },
  { key: 'notes',          aliases: ['notes', 'note', 'description', 'context', 'relationship notes', 'additional context'] },
  { key: 'notesFromLastEngagement', aliases: ['notes (from last engagement)', 'notes from last engagement', 'last engagement notes'] },
  { key: 'relationship',   aliases: ['relationship', 'how met', 'howmet', 'relationship context', 'connection'] },
  { key: 'lastContact',    aliases: ['last contact', 'lastcontact', 'when last contact', 'last spoke'] },
  { key: 'awareOfBusiness',aliases: ['knows your business', 'aware of business', 'aware', 'knows business'] },
  { key: 'usingCompetitor',aliases: ['using competitor', 'competitor', 'using a competitor'] },
  { key: 'workedTogetherAt',aliases: ['worked together at', 'worked together', 'worked at', 'prior company'] },
  { key: 'priorEngagement',aliases: ['prior work together', 'prior engagement', 'prior eng', 'did work together'] },
];

function normalizeHeader(h) {
  const s = (h || '').toLowerCase().replace(/[?()]/g, '').trim();
  return s;
}

function findColumnIndex(headers, fieldKey) {
  const row = COLUMN_MAP.find((r) => r.key === fieldKey);
  if (!row) return -1;
  const normHeaders = headers.map(normalizeHeader);
  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i];
    if (row.aliases.some((a) => h.includes(a) || a.includes(h))) return i;
  }
  return -1;
}

function parseCSVText(text) {
  const normalized = text.replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];

  const firstLine = parseCSVLine(lines[0]);
  const looksLikeHeader = COLUMN_MAP.some((row) =>
    firstLine.some((h) => row.aliases.some((a) => normalizeHeader(h).includes(a)))
  );

  let headers = null;
  let dataLines = lines;
  if (looksLikeHeader) {
    headers = firstLine;
    dataLines = lines.slice(1);
  }

  const idx = (key) => headers ? findColumnIndex(headers, key) : -1;
  const pos = (key, fallback) => {
    const i = idx(key);
    return i >= 0 ? i : fallback;
  };

  const get = (parts, i) => (i >= 0 && i < parts.length ? (parts[i] || '').trim() : '');
  const getYN = (v) => {
    const s = (v || '').toLowerCase().trim();
    if (['y', 'yes', '1', 'true'].includes(s)) return 'y';
    if (['n', 'no', '0', 'false'].includes(s)) return 'n';
    return '';
  };

  return dataLines
    .map((l) => parseCSVLine(l))
    .filter((p) => p.some((v) => v))
    .map((parts) => {
      const notes = (get(parts, pos('notes', 4)) || get(parts, idx('notesFromLastEngagement'))).trim();
      const relationship = get(parts, idx('relationship')) || inferRelationshipFromNotes(notes);
      return {
        name:             get(parts, pos('name', 0)),
        company:          get(parts, pos('company', 1)),
        title:            get(parts, pos('title', 2)),
        linkedin:         get(parts, pos('linkedin', 3)),
        relationship,
        notes,
        lastContact:      get(parts, idx('lastContact')),
        awareOfBusiness:  getYN(get(parts, idx('awareOfBusiness'))),
        usingCompetitor:  getYN(get(parts, idx('usingCompetitor'))),
        workedTogetherAt: get(parts, idx('workedTogetherAt')),
        priorEngagement:  getYN(get(parts, idx('priorEngagement'))),
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

      {/* Engagement history — full width, drives relationship inference */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Engagement history</label>
        <textarea
          value={contact.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Quick signals — optional, feed directly into relationship_contexts */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick signals <span className="font-normal normal-case text-gray-400">(optional — helps AI pick the right template)</span></p>

        {/* Last contact + Worked together at */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Last contact</label>
            <input
              type="text"
              value={contact.lastContact || ''}
              onChange={(e) => update('lastContact', e.target.value)}
              placeholder="e.g. 2 years ago, last month"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Worked together at</label>
            <input
              type="text"
              value={contact.workedTogetherAt || ''}
              onChange={(e) => update('workedTogetherAt', e.target.value)}
              placeholder="Company name, or leave blank"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Y/N toggles */}
        <div className="flex flex-wrap gap-4">
          {[
            { field: 'awareOfBusiness', label: 'Aware of my business?' },
            { field: 'usingCompetitor', label: 'Using a competitor?' },
            { field: 'priorEngagement', label: 'Did work together before?' },
          ].map(({ field, label }) => (
            <div key={field} className="flex items-center gap-2">
              <span className="text-xs text-gray-600">{label}</span>
              <div className="flex rounded-md border border-gray-300 overflow-hidden text-xs">
                {['y', 'n'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => update(field, contact[field] === val ? '' : val)}
                    className={`px-2.5 py-1 font-medium transition ${
                      contact[field] === val
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {val === 'y' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Relationship Context — auto-filled from engagement history */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Relationship Context</label>
          {inferredRelationship && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              <Sparkles className="h-3 w-3" />
              Auto-detected from engagement history
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

  // ── Step 5: outreach prep per saved contact ──
  const [outreachIdx, setOutreachIdx] = useState(0);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [personaSuggestion, setPersonaSuggestion] = useState(null); // { suggestedPersonaSlug, confidence, reasoning }
  const [appliedSlug, setAppliedSlug] = useState(null);
  const [applyingSlug, setApplyingSlug] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [matchedTemplates, setMatchedTemplates] = useState([]);
  const [hydratedSubject, setHydratedSubject] = useState('');
  const [hydratedBody, setHydratedBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedBody, setGeneratedBody] = useState('');
  const [savingGenTemplate, setSavingGenTemplate] = useState(false);
  const [genTemplateSaved, setGenTemplateSaved] = useState(false);

  const fileInputRef = useRef(null);

  const resetOutreach = () => {
    setOutreachIdx(0);
    setLoadingSuggestion(false);
    setPersonaSuggestion(null);
    setAppliedSlug(null);
    setApplyingSlug(false);
    setLoadingTemplates(false);
    setMatchedTemplates([]);
    setHydratedSubject('');
    setHydratedBody('');
    setCopied(false);
    setGenerating(false);
    setGeneratedBody('');
    setSavingGenTemplate(false);
    setGenTemplateSaved(false);
  };

  const reset = () => {
    setStep(0);
    setMethod(null);
    setInputText('');
    setContacts([]);
    setCurrentIdx(0);
    setParseError('');
    setSaving(false);
    setResult(null);
    resetOutreach();
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
      setParseError('Could not parse contacts. Use: Name | Company | Title | LinkedIn | Additional Context (one per line).');
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

  // Current contact in step 5
  const outreachContacts = result?.savedContacts || [];
  const outreachContact = outreachContacts[outreachIdx] || null;

  // Auto-load persona suggestion when entering step 5 or navigating to a new contact
  useEffect(() => {
    if (step !== 5 || !outreachContact?.id) return;
    resetOutreach();
    setLoadingSuggestion(true);

    auth.currentUser?.getIdToken().then((token) => {
      fetch(`/api/contacts/${outreachContact.id}/suggest-persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setPersonaSuggestion(data);
        })
        .catch(() => {})
        .finally(() => setLoadingSuggestion(false));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, outreachIdx]);

  const handleApplyPersona = async (slug) => {
    if (!outreachContact?.id || !slug) return;
    setApplyingSlug(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/contacts/${outreachContact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outreachPersonaSlug: slug }),
      });
      const data = await res.json();
      if (data.success) {
        setAppliedSlug(slug);
        // Fetch matching templates
        setLoadingTemplates(true);
        const tRes = await fetch(
          `/api/templates?companyHQId=${encodeURIComponent(companyHQId)}&personaSlug=${encodeURIComponent(slug)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const tData = await tRes.json();
        const templates = tData.templates || [];
        setMatchedTemplates(templates);
        if (templates.length > 0) {
          const tpl = templates[0];
          setHydratedSubject(hydrateTemplate(tpl.subject, outreachContact));
          setHydratedBody(hydrateTemplate(tpl.body, outreachContact));
        }
        setLoadingTemplates(false);
      }
    } catch (err) {
      console.error('Error applying persona:', err);
    } finally {
      setApplyingSlug(false);
    }
  };

  const handleGenerate = async () => {
    if (!outreachContact?.id || !companyHQId) return;
    setGenerating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/template/generate-with-snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyHQId,
          contactId: outreachContact.id,
          intent: outreachContact.notes || outreachContact.howMet || 'outreach',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedBody(data.template?.body || '');
        setHydratedSubject(data.template?.subject || '');
        setHydratedBody(data.template?.body || '');
      }
    } catch (err) {
      console.error('Generate error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGeneratedTemplate = async () => {
    if (!appliedSlug || !hydratedBody || !companyHQId) return;
    setSavingGenTemplate(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyHQId,
          title: `${appliedSlug} – generated`,
          subject: hydratedSubject,
          body: hydratedBody,
          personaSlug: appliedSlug,
        }),
      });
      const data = await res.json();
      if (data.success) setGenTemplateSaved(true);
    } catch (err) {
      console.error('Save template error:', err);
    } finally {
      setSavingGenTemplate(false);
    }
  };

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
                    <span className="font-mono text-xs">Name | Company | Title | LinkedIn | Additional Context</span>
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
                  Expected columns: <strong>Name, Company, Title, LinkedIn URL, Relationship Context, Additional Context</strong>
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
                Relationship context is inferred from your engagement history automatically. Refine it in the next step.
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

          {/* ── Step 5: Outreach Prep ── */}
          {step === 5 && (
            <div className="space-y-5">
              {/* Contact navigator */}
              {outreachContacts.length > 1 && (
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-semibold">{outreachContact?.fullName || [outreachContact?.firstName, outreachContact?.lastName].filter(Boolean).join(' ') || '—'}</span>
                  <span>{outreachIdx + 1} of {outreachContacts.length}</span>
                </div>
              )}

              {/* Persona suggestion card */}
              {!appliedSlug && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Suggested Persona</p>
                  {loadingSuggestion ? (
                    <div className="flex items-center gap-2 text-sm text-indigo-600">
                      <Sparkles className="h-4 w-4 animate-pulse" /> Analysing engagement history…
                    </div>
                  ) : personaSuggestion ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-bold text-purple-800">
                          {personaSuggestion.suggestedPersonaSlug}
                        </span>
                        {personaSuggestion.confidence && (
                          <span className="text-xs text-indigo-500">{personaSuggestion.confidence}% confidence</span>
                        )}
                      </div>
                      {personaSuggestion.reasoning && (
                        <p className="text-xs text-indigo-700 leading-relaxed">{personaSuggestion.reasoning}</p>
                      )}
                      <button
                        onClick={() => handleApplyPersona(personaSuggestion.suggestedPersonaSlug)}
                        disabled={applyingSlug}
                        className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
                      >
                        {applyingSlug ? 'Applying…' : '✓ Apply this persona'}
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-indigo-600 italic">No suggestion — add engagement history to the contact for a better result.</p>
                  )}
                </div>
              )}

              {/* Persona applied — template section */}
              {appliedSlug && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-gray-800">Persona applied:</span>
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">{appliedSlug}</span>
                  </div>

                  {loadingTemplates ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Sparkles className="h-4 w-4 animate-pulse" /> Looking up templates…
                    </div>
                  ) : matchedTemplates.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Template found — hydrated for {outreachContact?.firstName || 'this contact'}
                      </p>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">Subject</label>
                          <input
                            type="text"
                            value={hydratedSubject}
                            onChange={(e) => setHydratedSubject(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">Body</label>
                          <textarea
                            value={hydratedBody}
                            onChange={(e) => setHydratedBody(e.target.value)}
                            rows={8}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`Subject: ${hydratedSubject}\n\n${hydratedBody}`);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2500);
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                          >
                            {copied ? '✓ Copied!' : 'Copy email'}
                          </button>
                          {matchedTemplates.length > 1 && (
                            <button
                              onClick={() => {
                                const next = matchedTemplates[(matchedTemplates.indexOf(matchedTemplates.find(t => hydrateTemplate(t.body, outreachContact) === hydratedBody)) + 1) % matchedTemplates.length];
                                if (next) { setHydratedSubject(hydrateTemplate(next.subject, outreachContact)); setHydratedBody(hydrateTemplate(next.body, outreachContact)); }
                              }}
                              className="text-xs text-purple-600 hover:underline"
                            >
                              Try another template ({matchedTemplates.length} available)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* No template found — offer generation */
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center space-y-3">
                      <p className="text-sm text-gray-600">No template saved for <strong>{appliedSlug}</strong> yet.</p>
                      {!hydratedBody ? (
                        <button
                          onClick={handleGenerate}
                          disabled={generating}
                          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 mx-auto"
                        >
                          <Sparkles className="h-4 w-4" />
                          {generating ? 'Generating…' : 'Generate email from phrase library'}
                        </button>
                      ) : (
                        <div className="space-y-3 text-left">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-500">Subject</label>
                            <input
                              type="text"
                              value={hydratedSubject}
                              onChange={(e) => setHydratedSubject(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-500">Body</label>
                            <textarea
                              value={hydratedBody}
                              onChange={(e) => setHydratedBody(e.target.value)}
                              rows={8}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`Subject: ${hydratedSubject}\n\n${hydratedBody}`);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2500);
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                            >
                              {copied ? '✓ Copied!' : 'Copy email'}
                            </button>
                            {!genTemplateSaved ? (
                              <button
                                onClick={handleSaveGeneratedTemplate}
                                disabled={savingGenTemplate}
                                className="flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                              >
                                {savingGenTemplate ? 'Saving…' : 'Save as persona template'}
                              </button>
                            ) : (
                              <span className="text-sm text-green-600 font-medium">✓ Saved to template library</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
          <div className="flex justify-center border-t border-gray-200 px-6 py-4 flex-shrink-0 gap-3 flex-wrap">
            <button onClick={reset} className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              Submit more
            </button>
            {result?.savedContacts?.length > 0 && (
              <button
                onClick={() => { setOutreachIdx(0); setStep(5); }}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
              >
                <Sparkles className="h-4 w-4" />
                Set up outreach
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            <button onClick={handleClose} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              Done
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              {outreachIdx > 0 && (
                <button
                  onClick={() => { resetOutreach(); setOutreachIdx((i) => i - 1); }}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {outreachIdx < outreachContacts.length - 1 ? (
                <button
                  onClick={() => { resetOutreach(); setOutreachIdx((i) => i + 1); }}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Next contact <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={handleClose} className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700">
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
